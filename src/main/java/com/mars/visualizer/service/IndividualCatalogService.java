package com.mars.visualizer.service;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import tools.jackson.databind.ObjectMapper;
import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.dto.CatalogCache;
import com.mars.visualizer.dto.response.IndividualYearInfo;
import com.mars.visualizer.exception.ValidationException;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

/**
 * Service de catalogage des fichiers NetCDF individuels.
 * Scanne automatiquement les sous-repertoires de {@code netcdf.individual.path}
 * au demarrage et construit un catalogue en memoire indexe par annee martienne (MY).
 *
 * <p>Le catalogue est persisté dans {@code .catalog-cache.json} dans le dossier
 * {@code individual/}. Au redémarrage, si le dossier n'a pas été modifié
 * (comparaison par {@code lastModifiedTime}), le JSON est rechargé directement
 * sans rescanner le filesystem — démarrage quasi-instantané.
 *
 * <p>Structure attendue sur disque :
 * <pre>
 *   individual/
 *   +-- 000960/         (premier bloc de fichiers)
 *   |   +-- hl-b274_000000p_ls000_0000.nc
 *   |   +-- ...
 *   +-- 001920/         (bloc suivant)
 *   +-- ...
 * </pre>
 *
 * <p>L'annee martienne (MY) est deduite automatiquement par detection de
 * retour en arriere du Ls entre dossiers successifs.
 */
@Service
@Slf4j
public class IndividualCatalogService {

	/** Regex pour extraire Ls depuis le nom de fichier : ls{AAA}_{BBBB}. */
	private static final Pattern LS_PATTERN    = Pattern.compile("ls(\\d{3})_(\\d{4})");
	private static final String  CACHE_FILENAME = ".catalog-cache.json";

	private final DataPathConfig pathConfig;
	private final ObjectMapper   objectMapper;

	@Value("${netcdf.individual.my_base:34}")
	private int myBase;

	/** Catalogue par annee martienne, construit au demarrage. */
	private List<IndividualYearInfo> yearInfos = Collections.emptyList();

	/** Metadonnees par repertoire, pour la recherche de fichiers. */
	private List<DirInfo> dirInfos = Collections.emptyList();

	public IndividualCatalogService(DataPathConfig pathConfig, ObjectMapper objectMapper) {
		this.pathConfig   = pathConfig;
		this.objectMapper = objectMapper;
	}

	/** Metadonnees internes d'un sous-repertoire. */
	record DirInfo(String dirName, Path dirPath, double lsMin, double lsMax, int marsYear) {}

	// =========================================================================
	// Initialisation
	// =========================================================================

	/**
	 * Charge le catalogue au démarrage.
	 * Essaie d'abord le cache JSON ; effectue un scan complet si le cache
	 * est absent, illisible ou périmé, puis sauvegarde le cache mis à jour.
	 */
	@PostConstruct
	public void initCatalog() {
		Path individualRoot = pathConfig.getIndividualPath();
		Path cacheFile      = individualRoot.resolve(CACHE_FILENAME);

		// 1. Tenter de charger depuis le cache JSON
		if (Files.exists(cacheFile)) {
			try {
				long         dirLastModified = Files.getLastModifiedTime(individualRoot).toMillis();
				CatalogCache cached          = objectMapper.readValue(cacheFile.toFile(), CatalogCache.class);

				if (cached.getDirLastModified() == dirLastModified) {
					this.yearInfos = Collections.unmodifiableList(cached.getYearInfos());
					this.dirInfos  = Collections.unmodifiableList(
						cached.getDirInfos().stream()
							.map(c -> new DirInfo(
								c.getDirName(), Path.of(c.getDirPath()),
								c.getLsMin(), c.getLsMax(), c.getMarsYear()))
							.toList()
					);
					log.info("Catalogue INDIVIDUAL chargé depuis cache JSON ({} années, {} répertoires)",
						yearInfos.size(), dirInfos.size());
					return;
				}
				log.info("Cache JSON périmé (dossier individual/ modifié), rescan complet");

			} catch (Exception e) {
				log.warn("Cache JSON illisible ou corrompu, rescan complet : {}", e.getMessage());
			}
		}

		// 2. Scan complet du filesystem
		doFullScan(individualRoot);

		// 3. Sauvegarder le nouveau cache
		saveToCache(cacheFile, individualRoot);
	}

	// =========================================================================
	// API publique
	// =========================================================================

	/**
	 * Retourne les annees martiennes disponibles avec leurs bornes Ls.
	 */
	public List<IndividualYearInfo> getAvailableYears() {
		return yearInfos;
	}

	/**
	 * Trouve le fichier .nc dont le Ls est le plus proche du Ls cible
	 * pour l'annee martienne demandee.
	 *
	 * <p>Algorithme en deux phases :
	 * <ol>
	 *   <li>Trouver le repertoire dont la plage Ls contient ou est la plus proche du Ls cible</li>
	 *   <li>Scanner les fichiers de ce repertoire et retourner le plus proche</li>
	 * </ol>
	 *
	 * @param marsYear annee martienne (ex: 34)
	 * @param targetLs longitude solaire cible (ex: 5.5)
	 * @return chemin absolu vers le fichier .nc le plus proche
	 * @throws ValidationException si aucun fichier trouve
	 */
	public Path findClosestFile(int marsYear, double targetLs) {

		// Filtrer les repertoires de cette annee
		List<DirInfo> myDirs = dirInfos.stream()
				.filter(d -> d.marsYear() == marsYear)
				.toList();

		if (myDirs.isEmpty()) {
			throw new ValidationException(
					"Annee martienne MY" + marsYear + " non disponible dans les fichiers individuels.");
		}

		// Phase 1 : trouver le meilleur repertoire
		DirInfo bestDir     = null;
		double  bestDirDist = Double.MAX_VALUE;

		for (DirInfo d : myDirs) {
			double dist;
			if (targetLs >= d.lsMin() && targetLs <= d.lsMax()) {
				dist = 0; // cible dans la plage
			} else {
				dist = Math.min(Math.abs(targetLs - d.lsMin()),
								Math.abs(targetLs - d.lsMax()));
			}
			if (dist < bestDirDist) {
				bestDirDist = dist;
				bestDir     = d;
			}
		}

		if (bestDir == null) {
			throw new ValidationException(
					"Aucun repertoire trouve pour MY" + marsYear + " Ls " + targetLs);
		}

		// Phase 2 : trouver le meilleur fichier dans le repertoire
		try {
			List<String> files    = listNcFilesSorted(bestDir.dirPath());
			String       bestFile = null;
			double       bestDist = Double.MAX_VALUE;

			for (String f : files) {
				double ls   = parseLsFromFilename(f);
				double dist = Math.abs(ls - targetLs);
				if (dist < bestDist) {
					bestDist = dist;
					bestFile = f;
				}
			}

			if (bestFile == null) {
				throw new ValidationException(
						"Aucun fichier individuel trouve pour MY" + marsYear + " Ls " + targetLs);
			}

			Path result = bestDir.dirPath().resolve(bestFile);
			log.info("findClosestFile : MY{}, Ls cible={}, fichier={}, Ls reel={}",
					marsYear, targetLs, bestFile,
					String.format("%.4f", parseLsFromFilename(bestFile)));
			return result;

		} catch (IOException e) {
			throw new ValidationException(
					"Erreur lecture repertoire " + bestDir.dirName() + " : " + e.getMessage());
		}
	}

	/**
	 * Extrait le Ls reel depuis le nom d'un fichier .nc.
	 *
	 * @param filePath chemin vers le fichier
	 * @return longitude solaire en degres
	 */
	public double getActualLs(Path filePath) {
		return parseLsFromFilename(filePath.getFileName().toString());
	}

	// =========================================================================
	// Scan filesystem
	// =========================================================================

	/**
	 * Scanne l'intégralité du dossier individual/ et remplit
	 * {@code this.dirInfos} et {@code this.yearInfos}.
	 */
	private void doFullScan(Path individualRoot) {
		log.info("Scan complet du catalogue INDIVIDUAL depuis : {}", individualRoot);

		// 1. Lister les sous-dossiers numeriques, tries
		List<Path> subDirs = new ArrayList<>();
		try (DirectoryStream<Path> stream = Files.newDirectoryStream(individualRoot)) {
			for (Path entry : stream) {
				if (Files.isDirectory(entry) && entry.getFileName().toString().matches("\\d+")) {
					subDirs.add(entry);
				}
			}
		} catch (IOException e) {
			log.error("Erreur scan repertoire INDIVIDUAL : {}", e.getMessage());
			return;
		}

		subDirs.sort(Comparator.comparing(p -> Integer.parseInt(p.getFileName().toString())));

		if (subDirs.isEmpty()) {
			log.warn("Aucun sous-repertoire numerique dans {}", individualRoot);
			return;
		}

		// 2. Construire les DirInfo avec detection de changement de MY
		List<DirInfo> dirs          = new ArrayList<>();
		int           currentMarsYear = myBase;
		double        prevLsMax     = -1;

		for (Path dir : subDirs) {
			String dirName = dir.getFileName().toString();
			try {
				List<String> ncFiles = listNcFilesSorted(dir);
				if (ncFiles.isEmpty()) {
					log.warn("Repertoire vide ignore : {}", dirName);
					continue;
				}

				double firstLs = parseLsFromFilename(ncFiles.getFirst());
				double lastLs  = parseLsFromFilename(ncFiles.getLast());

				// Si le Ls de debut est inferieur au Ls de fin du dossier precedent
				// → nouvelle annee martienne
				if (prevLsMax >= 0 && firstLs < prevLsMax) {
					currentMarsYear++;
					log.info("Nouvelle annee martienne detectee : MY{}", currentMarsYear);
				}

				dirs.add(new DirInfo(dirName, dir, firstLs, lastLs, currentMarsYear));
				prevLsMax = lastLs;

				log.debug("Repertoire {} : MY{}, Ls {}-{}, {} fichiers",
						dirName, currentMarsYear,
						String.format("%.2f", firstLs),
						String.format("%.2f", lastLs),
						ncFiles.size());

			} catch (Exception e) {
				log.warn("Erreur traitement repertoire '{}' : {}", dirName, e.getMessage());
			}
		}

		this.dirInfos = Collections.unmodifiableList(dirs);

		// 3. Grouper par MY → IndividualYearInfo
		List<IndividualYearInfo> years       = new ArrayList<>();
		int                      currentYear = -1;
		double                   yearLsMin   = 0;
		double                   yearLsMax   = 0;
		List<String>             yearDirs    = new ArrayList<>();

		for (DirInfo di : dirs) {
			if (di.marsYear() != currentYear) {
				if (currentYear >= 0) {
					years.add(IndividualYearInfo.builder()
							.marsYear(currentYear)
							.lsMin(yearLsMin)
							.lsMax(yearLsMax)
							.directories(List.copyOf(yearDirs))
							.build());
				}
				currentYear = di.marsYear();
				yearLsMin   = di.lsMin();
				yearDirs    = new ArrayList<>();
			}
			yearLsMax = di.lsMax();
			yearDirs.add(di.dirName());
		}

		// Derniere annee
		if (currentYear >= 0) {
			years.add(IndividualYearInfo.builder()
					.marsYear(currentYear)
					.lsMin(yearLsMin)
					.lsMax(yearLsMax)
					.directories(List.copyOf(yearDirs))
					.build());
		}

		this.yearInfos = Collections.unmodifiableList(years);

		// Log recapitulatif
		log.info("Catalogue INDIVIDUAL : {} annees, {} repertoires scannes",
				yearInfos.size(), dirInfos.size());
		for (IndividualYearInfo y : yearInfos) {
			boolean partiel = y.getLsMax() < 350;
			log.info("  MY{}: Ls {}° -> {}° ({} dossiers{})",
					y.getMarsYear(),
					String.format("%.2f", y.getLsMin()),
					String.format("%.2f", y.getLsMax()),
					y.getDirectories().size(),
					partiel ? ", partiel" : "");
		}
	}

	// =========================================================================
	// Persistance du cache
	// =========================================================================

	/**
	 * Sérialise le catalogue courant dans {@code cacheFile}.
	 * Toute erreur d'écriture est loggée sans bloquer le démarrage.
	 */
	private void saveToCache(Path cacheFile, Path individualRoot) {
		try {
			long dirLastModified = Files.getLastModifiedTime(individualRoot).toMillis();

			List<CatalogCache.CachedDirInfo> cachedDirs = dirInfos.stream()
				.map(d -> new CatalogCache.CachedDirInfo(
					d.dirName(),
					d.dirPath().toAbsolutePath().toString(),
					d.lsMin(),
					d.lsMax(),
					d.marsYear()))
				.toList();

			objectMapper.writeValue(
				cacheFile.toFile(),
				new CatalogCache(dirLastModified, new ArrayList<>(yearInfos), cachedDirs));

			log.info("Cache catalogue INDIVIDUAL sauvegardé : {}", cacheFile);

		} catch (IOException e) {
			log.warn("Impossible de sauvegarder le cache catalogue (non bloquant) : {}", e.getMessage());
		}
	}

	// =========================================================================
	// Methodes utilitaires
	// =========================================================================

	/**
	 * Liste les fichiers .nc d'un repertoire, tries par nom.
	 */
	private List<String> listNcFilesSorted(Path dir) throws IOException {
		List<String> files = new ArrayList<>();
		try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir, "*.nc")) {
			for (Path entry : stream) {
				if (Files.isRegularFile(entry)) {
					files.add(entry.getFileName().toString());
				}
			}
		}
		Collections.sort(files);
		return files;
	}

	/**
	 * Parse le Ls depuis un nom de fichier via le pattern ls{AAA}_{BBBB}.
	 * Formule : Ls = AAA + BBBB / 10000.0
	 *
	 * @param filename nom du fichier (ex: hl-b274_000050p_ls001_0100.nc)
	 * @return longitude solaire en degres (ex: 1.01)
	 */
	private double parseLsFromFilename(String filename) {
		Matcher m = LS_PATTERN.matcher(filename);
		if (!m.find()) {
			throw new IllegalArgumentException("Ls introuvable dans le nom de fichier : " + filename);
		}
		int aaa  = Integer.parseInt(m.group(1));
		int bbbb = Integer.parseInt(m.group(2));
		return aaa + bbbb / 10000.0;
	}
}
