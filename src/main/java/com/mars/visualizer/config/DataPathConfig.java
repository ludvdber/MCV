package com.mars.visualizer.config;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

/**
 * Configuration des chemins d'accès aux fichiers NetCDF. Valide l'existence des
 * répertoires au démarrage de l'app.
 */
@Configuration
@Slf4j
@Getter
public class DataPathConfig {

	/**
	 * Chemin vers les fichiers MEAN et les fichiers individuels.
	 */
	@Value("${netcdf.mean.path}")
	private String meanPathString;

	@Value("${netcdf.individual.path}")
	private String individualPathString;

	/**
	 * Path résolu pour les répertoires.
	 */
	private Path meanPath;
	private Path individualPath;

	/**
	 * Nettoie un chemin fourni par la configuration : espaces parasites et
	 * guillemets d'encadrement (frequents quand on colle un chemin reseau
	 * copie depuis l'explorateur Windows ou un shell).
	 *
	 * Les chemins reseau sont supportes tels quels par java.nio :
	 * - Windows UNC : {@code \\serveur\partage\mars} (dans un fichier
	 *   .properties, doubler chaque backslash : {@code \\\\serveur\\partage\\mars})
	 *   ou la forme equivalente a slashes {@code //serveur/partage/mars}
	 * - Linux : point de montage NFS/CIFS classique, ex. {@code /mnt/mars-data/mean}
	 */
	private static Path resolvePath(String pathString) {
		String cleaned = pathString == null ? "" : pathString.trim();
		if (cleaned.length() >= 2
				&& ((cleaned.startsWith("\"") && cleaned.endsWith("\""))
						|| (cleaned.startsWith("'") && cleaned.endsWith("'")))) {
			cleaned = cleaned.substring(1, cleaned.length() - 1).trim();
		}
		return Paths.get(cleaned);
	}

	/**
	 * Valide qu'un chemin existe et est un répertoire.
	 *
	 * @param label      nom du répertoire pour les logs
	 * @param path       chemin résolu à valider
	 * @param property   clé de configuration correspondante (pour le message d'aide)
	 * @param envVar     variable d'environnement equivalente
	 * @throws IllegalStateException si le chemin est invalide
	 */
	private void validatePath(String label, Path path, String property, String envVar) {
		String help = " Configurez « " + property + " » dans config/application.properties"
				+ " (a cote du JAR) ou via la variable d'environnement " + envVar
				+ ". Chemins reseau acceptes : \\\\serveur\\partage\\... (Windows, doubler les"
				+ " backslashes dans un .properties, ou ecrire //serveur/partage/...),"
				+ " /mnt/... (montage Linux).";

		if (!Files.exists(path)) {
			String errorMsg = "Le répertoire " + label + " n'existe pas : " + path + "." + help;
			log.error(errorMsg);
			throw new IllegalStateException(errorMsg);
		}

		if (!Files.isDirectory(path)) {
			String errorMsg = "Le chemin " + label + " n'est pas un répertoire : " + path + "." + help;
			log.error(errorMsg);
			throw new IllegalStateException(errorMsg);
		}
	}

	/**
	 * Initialise et valide les chemins d'accès aux fichiers.
	 *
	 * @throws IllegalStateException si un répertoire n'existe pas
	 */
	@PostConstruct
	public void initialize() {
		log.info("Initialisation des chemins NetCDF");

		// Validation du répertoire MEAN
		meanPath = resolvePath(meanPathString);
		validatePath("MEAN", meanPath, "netcdf.mean.path", "NETCDF_MEAN_PATH");
		log.info("Répertoire MEAN validé : {}", meanPath.toAbsolutePath());

		// Validation du répertoire individual
		individualPath = resolvePath(individualPathString);
		validatePath("individual", individualPath, "netcdf.individual.path", "NETCDF_INDIVIDUAL_PATH");
		log.info("Répertoire individual validé : {}", individualPath.toAbsolutePath());

		log.info("Configuration des chemins terminée avec succès");
	}
}