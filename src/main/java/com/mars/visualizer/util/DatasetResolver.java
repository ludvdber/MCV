package com.mars.visualizer.util;

import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.CatalogService;
import com.mars.visualizer.service.IndividualCatalogService;

/**
 * Composant utilitaire centralisant la logique de resolution des datasets
 * MEAN et INDIVIDUAL, ainsi que les conversions communes utilisees par
 * les controllers {@code FileController} et {@code ExportController}.
 *
 * @author Ludo
 * @version 1.0
 */
@Component
public class DatasetResolver {

	/** Pattern pour parser un dataset INDIVIDUAL : IND_MY{nn}_LS{dd.dd} */
	private static final Pattern IND_PATTERN = Pattern.compile("IND_MY(\\d+)_LS([\\d.]+)");

	private final CatalogService           catalogService;
	private final IndividualCatalogService individualCatalogService;

	public DatasetResolver(CatalogService catalogService,
						   IndividualCatalogService individualCatalogService) {
		this.catalogService           = catalogService;
		this.individualCatalogService = individualCatalogService;
	}

	/**
	 * Detecte si le dataset est un identifiant INDIVIDUAL (prefixe IND_).
	 */
	public boolean isIndividualDataset(String dataset) {
		return dataset != null && dataset.startsWith("IND_");
	}

	/**
	 * Resout un dataset en nom de fichier (MEAN) ou chemin absolu (INDIVIDUAL).
	 */
	public String resolveFilename(String dataset) {
		if (isIndividualDataset(dataset)) {
			return resolveIndividualFile(dataset);
		}
		return catalogService.getFilenameById(dataset)
				.orElseThrow(() -> new ValidationException("error.dataset.not.found", dataset));
	}

	/**
	 * Parse un identifiant IND_MY{nn}_LS{dd.dd} et retourne le chemin absolu
	 * du fichier .nc le plus proche.
	 */
	public String resolveIndividualFile(String dataset) {
		Matcher m = IND_PATTERN.matcher(dataset);
		if (!m.matches()) {
			throw new ValidationException("error.dataset.individual.format", dataset);
		}
		int marsYear    = Integer.parseInt(m.group(1));
		double targetLs = Double.parseDouble(m.group(2));

		Path filePath = individualCatalogService.findClosestFile(marsYear, targetLs);
		return filePath.toAbsolutePath().toString();
	}

	/**
	 * Retourne le Ls reel du fichier individuel resolu, ou null pour MEAN.
	 */
	public Double getActualLs(String dataset, String resolvedPath) {
		if (!isIndividualDataset(dataset)) return null;
		return individualCatalogService.getActualLs(Path.of(resolvedPath));
	}

	/**
	 * Retourne 0 si le dataset est INDIVIDUAL, sinon retourne le time original.
	 */
	public int adjustTimeForIndividual(String dataset, int time) {
		return isIndividualDataset(dataset) ? 0 : time;
	}

	/**
	 * Formate une coordonnee pour utilisation dans les noms de fichiers.
	 * Le point decimal est remplace par 'p', et le signe negatif par 'm'.
	 */
	public String formatCoord(double coord) {
		String formatted = String.valueOf(coord).replace('.', 'p');
		return coord < 0 ? "m" + formatted.substring(1) : formatted;
	}
}
