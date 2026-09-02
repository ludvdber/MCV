package com.mars.visualizer.service;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
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
 * {@code individual/}. Au redémarrage, si le contenu du dossier n'a pas changé,
 * le JSON est rechargé directement sans rescanner le filesystem — démarrage
 * quasi-instantané. Le contrôle porte sur une empreinte des sous-répertoires,
 * pas sur la date du dossier racine : voir {@link #computeSignature(Path)}.
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
	/** Un sous-répertoire d'année n'est retenu que si son nom est entièrement numérique. */
	private static final String  DIR_NAME_PATTERN = "\\d+";

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

		// Empreinte calculée AVANT le scan : si le dossier change pendant, la
		// signature enregistrée ne correspondra plus au prochain démarrage et
		// un rescan aura lieu. L'erreur penche du bon côté.
		String signature = computeSignature(individualRoot);

		// 1. Tenter de charger depuis le cache JSON
		if (signature != null && Files.exists(cacheFile)) {
			try {
				CatalogCache cached = objectMapper.readValue(cacheFile.toFile(), CatalogCache.class);

				if (signature.equals(cached.signature())) {
					this.yearInfos = Collections.unmodifiableList(cached.yearInfos());
					this.dirInfos  = Collections.unmodifiableList(
						cached.dirInfos().stream()
							.map(c -> new DirInfo(
								c.dirName(), Path.of(c.dirPath()),
								c.lsMin(), c.lsMax(), c.marsYear()))
							.toList()
					);
					log.info("Catalogue INDIVIDUAL chargé depuis cache JSON ({} années, {} répertoires)",
						yearInfos.size(), dirInfos.size());
					return;
				}
				log.info("Cache JSON périmé (contenu de individual/ modifié), rescan complet");

			} catch (Exception e) {
				// Volontairement Exception et non IOException : Jackson 3 lève des
				// exceptions NON VÉRIFIÉES. Un cache tronqué (écriture interrompue,
				// disque plein) empêchait le démarrage au lieu de retomber sur un
				// scan complet.
				log.warn("Cache JSON illisible ou corrompu, rescan complet : {}", e.getMessage());
			}
		}

		// 2. Scan complet du filesystem
		doFullScan(individualRoot);

		// 3. Sauvegarder le nouveau cache (sans empreinte fiable, on ne mémorise
		//    rien : mieux vaut rescanner que servir un catalogue faux)
		if (signature != null) {
			saveToCache(cacheFile, signature);
		}
	}

	/**
	 * Empreinte du contenu de {@code individual/} : nom et date de modification
	 * de chaque sous-répertoire d'année, triés.
	 *
	 * <p>Pourquoi pas simplement la date du dossier racine : un système de
	 * fichiers ne met à jour la date d'un dossier que lorsque <b>ses propres
	 * entrées</b> changent. Ajouter un {@code .nc} dans {@code individual/000960/}
	 * modifie la date de {@code 000960/}, pas celle de {@code individual/} — le
	 * cache se croyait alors valide et les bornes Ls de l'année restaient
	 * périmées, même après redémarrage. Regarder les sous-répertoires évite au
	 * passage que l'écriture de {@code .catalog-cache.json} dans le dossier
	 * racine n'invalide le cache qui vient d'être écrit.
	 *
	 * @return l'empreinte, ou {@code null} si le dossier est illisible
	 */
	private String computeSignature(Path individualRoot) {
		List<String> parts = new ArrayList<>();
		try (DirectoryStream<Path> stream = Files.newDirectoryStream(individualRoot)) {
			for (Path entry : stream) {
				String name = entry.getFileName().toString();
				if (name.matches(DIR_NAME_PATTERN) && Files.isDirectory(entry)) {
					parts.add(name + ':' + Files.getLastModifiedTime(entry).toMillis());
				}
			}
		} catch (IOException e) {
			log.warn("Empreinte du dossier INDIVIDUAL incalculable, scan complet : {}", e.getMessage());
			return null;
		}
		Collections.sort(parts);   // l'ordre de parcours du filesystem n'est pas garanti
		return String.join("|", parts);
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
			throw new ValidationException("error.individual.year.not.available", marsYear);
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
			throw new ValidationException("error.individual.dir.not.found", marsYear, targetLs);
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
				throw new ValidationException("error.individual.file.not.found", marsYear, targetLs);
			}

			Path result = bestDir.dirPath().resolve(bestFile);
			log.info("findClosestFile : MY{}, Ls cible={}, fichier={}, Ls reel={}",
					marsYear, targetLs, bestFile,
					String.format("%.4f", parseLsFromFilename(bestFile)));
			return result;

		} catch (IOException e) {
			throw new ValidationException("error.individual.dir.read",
					bestDir.dirName(), e.getMessage());
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
				if (Files.isDirectory(entry) && entry.getFileName().toString().matches(DIR_NAME_PATTERN)) {
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
		//    Le changement d'annee martienne peut se produire :
		//    a) entre deux repertoires (firstLs << prevLsMax)
		//    b) au sein d'un meme repertoire (lastLs << firstLs, ex: 359°→0°)
		//    Le seuil de 180° distingue un vrai wrap annuel d'un leger chevauchement.
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

				// (a) Changement d'annee ENTRE repertoires (drop > 180°)
				if (prevLsMax >= 0 && firstLs < prevLsMax - 180) {
					currentMarsYear++;
					log.info("Nouvelle annee martienne detectee : MY{}", currentMarsYear);
				}

				// (b) Changement d'annee AU SEIN du repertoire (Ls wrap 359°→0°)
				if (lastLs < firstLs - 180) {
					dirs.add(new DirInfo(dirName, dir, firstLs, 360.0, currentMarsYear));
					currentMarsYear++;
					log.info("Nouvelle annee martienne detectee (intra-repertoire {}) : MY{}", dirName, currentMarsYear);
					dirs.add(new DirInfo(dirName, dir, 0.0, lastLs, currentMarsYear));
				} else {
					dirs.add(new DirInfo(dirName, dir, firstLs, lastLs, currentMarsYear));
				}

				prevLsMax = lastLs;

				log.debug("Repertoire {} : MY{}, Ls {}-{}, {} fichiers",
						dirName, currentMarsYear,
						String.format("%.2f", firstLs),
						String.format("%.2f", lastLs),
						ncFiles.size());

			} catch (IOException | NumberFormatException e) {
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
					years.add(new IndividualYearInfo(currentYear, yearLsMin, yearLsMax, List.copyOf(yearDirs)));
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
			years.add(new IndividualYearInfo(currentYear, yearLsMin, yearLsMax, List.copyOf(yearDirs)));
		}

		this.yearInfos = Collections.unmodifiableList(years);

		// Log recapitulatif
		log.info("Catalogue INDIVIDUAL : {} annees, {} repertoires scannes",
				yearInfos.size(), dirInfos.size());
		for (IndividualYearInfo y : yearInfos) {
			boolean partiel = y.lsMax() < 350;
			log.info("  MY{}: Ls {}° -> {}° ({} dossiers{})",
					y.marsYear(),
					String.format("%.2f", y.lsMin()),
					String.format("%.2f", y.lsMax()),
					y.directories().size(),
					partiel ? ", partiel" : "");
		}
	}

	// =========================================================================
	// Persistance du cache
	// =========================================================================

	/**
	 * Sérialise le catalogue courant dans {@code cacheFile}.
	 *
	 * <p>Écriture dans un fichier temporaire puis renommage : une écriture
	 * interrompue (arrêt du serveur, disque plein) laisse alors le cache
	 * précédent intact au lieu d'un JSON tronqué. Toute erreur est journalisée
	 * sans bloquer le démarrage, le cache n'étant qu'une optimisation.
	 */
	private void saveToCache(Path cacheFile, String signature) {
		Path tmpFile = cacheFile.resolveSibling(CACHE_FILENAME + ".tmp");
		try {
			List<CatalogCache.CachedDirInfo> cachedDirs = dirInfos.stream()
				.map(d -> new CatalogCache.CachedDirInfo(
					d.dirName(),
					d.dirPath().toAbsolutePath().toString(),
					d.lsMin(),
					d.lsMax(),
					d.marsYear()))
				.toList();

			objectMapper.writeValue(
				tmpFile.toFile(),
				new CatalogCache(signature, new ArrayList<>(yearInfos), cachedDirs));
			Files.move(tmpFile, cacheFile, StandardCopyOption.REPLACE_EXISTING);

			log.info("Cache catalogue INDIVIDUAL sauvegardé : {}", cacheFile);

		} catch (Exception e) {
			// Exception et non IOException : Jackson 3 lève des exceptions non vérifiées.
			log.warn("Impossible de sauvegarder le cache catalogue (non bloquant) : {}", e.getMessage());
			try {
				Files.deleteIfExists(tmpFile);
			} catch (IOException suppressed) {
				log.debug("Fichier temporaire de cache non supprimé : {}", suppressed.getMessage());
			}
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
	 * Formule : Ls = AAA + BBBB / 10000.0, normalisé dans [0, 360).
	 * Le fichier ls360_0000 (Ls=360°) est normalisé à 0°.
	 *
	 * @param filename nom du fichier (ex: hl-b274_000050p_ls001_0100.nc)
	 * @return longitude solaire en degres (ex: 1.01)
	 */
	private double parseLsFromFilename(String filename) {
		Matcher m = LS_PATTERN.matcher(filename);
		if (!m.find()) {
			throw new ValidationException("error.individual.ls.parse", filename);
		}
		int aaa  = Integer.parseInt(m.group(1));
		int bbbb = Integer.parseInt(m.group(2));
		double ls = aaa + bbbb / 10000.0;
		return ls >= 360.0 ? ls - 360.0 : ls;
	}
}
