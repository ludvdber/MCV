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
	 * Valide qu'un chemin existe et est un répertoire.
	 * 
	 * @param label      nom du répertoire pour les logs
	 * @param pathString chemin à valider
	 * @throws IllegalStateException si le chemin est invalide
	 */
	private void validatePath(String label, String pathString) {
		Path path = Paths.get(pathString);

		if (!Files.exists(path)) {
			String errorMsg = "Le répertoire " + label + " n'existe pas : " + path;
			log.error(errorMsg);
			throw new IllegalStateException(errorMsg);
		}

		if (!Files.isDirectory(path)) {
			String errorMsg = "Le chemin " + label + " n'est pas un répertoire : " + path;
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
		validatePath("MEAN", meanPathString);
		meanPath = Paths.get(meanPathString);
		log.info("Répertoire MEAN validé : {}", meanPath.toAbsolutePath());

		// Validation du répertoire individual
		validatePath("individual", individualPathString);
		individualPath = Paths.get(individualPathString);
		log.info("Répertoire individual validé : {}", individualPath.toAbsolutePath());

		log.info("Configuration des chemins terminée avec succès");
	}
}