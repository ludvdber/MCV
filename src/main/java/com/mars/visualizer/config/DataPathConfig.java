package com.mars.visualizer.config;

import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.function.UnaryOperator;

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
	 * Acces a l'environnement du processus. C'est un champ, et non un appel
	 * direct a {@code System.getenv}, pour qu'un test puisse simuler une
	 * variable definie sans en poser une dans la JVM — ce que Java ne permet
	 * pas proprement.
	 */
	private UnaryOperator<String> environnement = System::getenv;

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
	private Path resolvePath(String pathString, String label, String property, String envVar) {
		String cleaned = pathString == null ? "" : pathString.trim();
		if (cleaned.length() >= 2
				&& ((cleaned.startsWith("\"") && cleaned.endsWith("\""))
						|| (cleaned.startsWith("'") && cleaned.endsWith("'")))) {
			cleaned = cleaned.substring(1, cleaned.length() - 1).trim();
		}
		// Une valeur VIDE est le piege du gabarit a moitie rempli : quelqu'un
		// laisse « netcdf.mean.path= » et lance. Paths.get("") rend le chemin
		// VIDE, que Files.exists et Files.isDirectory resolvent tous deux contre
		// le repertoire courant : les deux gardes passent, et l'application
		// demarre avec le dossier du JAR pour repertoire de donnees. Mesure sur
		// le JAR livre : demarrage nominal, catalogue vide, aucun message.
		// Une case laissee vide n'est pas une configuration, c'est un oubli.
		if (cleaned.isEmpty()) {
			throw refus("Le chemin " + label + " n'est pas renseigné.",
					"The " + label + " path is not set.", property, envVar);
		}

		// Un chemin colle depuis un explorateur peut porter un caractere que le
		// systeme refuse (un guillemet depareille sous Windows). Paths.get leve
		// alors une InvalidPathException, qui remonterait telle quelle et
		// priverait l'exploitant du message d'aide ci-dessous. Sous Linux le
		// meme chemin est legal et echoue plus loin, avec ce message : on aligne
		// les deux systemes sur la reponse utile.
		try {
			return Paths.get(cleaned);
		} catch (InvalidPathException e) {
			throw refus("Le chemin " + label + " n'est pas un chemin valide : " + cleaned + ".",
					"The " + label + " path is not a valid path: " + cleaned + ".",
					property, envVar, e);
		}
	}

	/**
	 * Fabrique le refus de demarrage : ce qui ne va pas d'un cote, ce qu'il faut
	 * faire de l'autre. Les deux moities sont separees parce que
	 * {@link ConfigurationFailureAnalyzer} les imprime sous deux titres
	 * distincts ; hors de Spring, le message complet reste leur concatenation.
	 */
	private ConfigurationInvalideException refus(String problemeFr, String problemeEn,
			String property, String envVar) {
		return refus(problemeFr, problemeEn, property, envVar, null);
	}

	private ConfigurationInvalideException refus(String problemeFr, String problemeEn,
			String property, String envVar, Throwable cause) {
		return new ConfigurationInvalideException(problemeFr + "\n" + problemeEn,
				aide(property, envVar), cause);
	}

	/**
	 * Le texte qui suit chaque refus de demarrage. Il est le seul endroit ou
	 * l'exploitant lira quoi corriger, donc il nomme la propriete, la variable
	 * d'environnement equivalente et l'emplacement du fichier.
	 *
	 * <p>Il est bilingue pour la meme raison que la banniere de premier
	 * demarrage : le JAR est publie et l'institut n'est pas francophone.
	 *
	 * <p>Et il commence par un AVERTISSEMENT quand la variable d'environnement
	 * est posee. Spring classe les variables d'environnement au-dessus du
	 * fichier externe : sans cette phrase, le refus envoie corriger un fichier
	 * que l'application n'ecoutera pas, et l'exploitant relance en boucle en
	 * voyant la meme erreur sur une ligne qu'il vient pourtant de changer. Le
	 * cas n'est pas theorique — l'unite systemd livree posait ces deux
	 * variables.
	 */
	private String aide(String property, String envVar) {
		String valeurEnv = environnement.apply(envVar);
		String avertissement = valeurEnv == null ? ""
				: "ATTENTION : la variable d'environnement " + envVar + " est définie ("
						+ valeurEnv + ") et l'emporte sur le fichier de configuration."
						+ " C'est elle qu'il faut corriger, pas le fichier.\n"
						+ "WARNING: the " + envVar + " environment variable is set ("
						+ valeurEnv + ") and overrides the configuration file. That is what"
						+ " must be corrected, not the file.\n\n";

		return avertissement
				+ "Renseignez « " + property + " » dans le fichier"
				+ " config/application.properties placé à côté du JAR (il est créé"
				+ " automatiquement au premier démarrage s'il manque), ou posez la variable"
				+ " d'environnement " + envVar + ".\n"
				+ "Chemins réseau acceptés : //serveur/partage/... ou"
				+ " \\\\serveur\\partage\\... (dans un .properties, doubler chaque"
				+ " backslash), /mnt/... (montage Linux).\n\n"
				+ "Set \"" + property + "\" in the config/application.properties file next to"
				+ " the JAR (it is created automatically on first start when missing), or set"
				+ " the " + envVar + " environment variable.\n"
				+ "Network paths are accepted: //server/share/... or"
				+ " \\\\server\\share\\... (double every backslash in a .properties file),"
				+ " /mnt/... (Linux mount).";
	}

	/**
	 * Valide qu'un chemin existe et est un répertoire.
	 *
	 * @param label      nom du répertoire pour les logs
	 * @param path       chemin résolu à valider
	 * @param property   clé de configuration correspondante (pour le message d'aide)
	 * @param envVar     variable d'environnement equivalente
	 * @throws ConfigurationInvalideException si le chemin est invalide
	 */
	private void validatePath(String label, Path path, String property, String envVar) {
		if (!Files.exists(path)) {
			throw refus("Le répertoire " + label + " n'existe pas : " + path + ".",
					"The " + label + " directory does not exist: " + path + ".",
					property, envVar);
		}

		if (!Files.isDirectory(path)) {
			throw refus("Le chemin " + label + " n'est pas un répertoire : " + path + ".",
					"The " + label + " path is not a directory: " + path + ".",
					property, envVar);
		}
	}

	/**
	 * Initialise et valide les chemins d'accès aux fichiers.
	 *
	 * @throws ConfigurationInvalideException si un répertoire n'existe pas
	 */
	@PostConstruct
	public void initialize() {
		log.info("Initialisation des chemins NetCDF");

		// Validation du répertoire MEAN
		meanPath = resolvePath(meanPathString, "MEAN", "netcdf.mean.path", "NETCDF_MEAN_PATH");
		validatePath("MEAN", meanPath, "netcdf.mean.path", "NETCDF_MEAN_PATH");
		log.info("Répertoire MEAN validé : {}", meanPath.toAbsolutePath());

		// Validation du répertoire individual
		individualPath = resolvePath(individualPathString, "individual", "netcdf.individual.path",
				"NETCDF_INDIVIDUAL_PATH");
		validatePath("individual", individualPath, "netcdf.individual.path", "NETCDF_INDIVIDUAL_PATH");
		log.info("Répertoire individual validé : {}", individualPath.toAbsolutePath());

		log.info("Configuration des chemins terminée avec succès");
	}
}
