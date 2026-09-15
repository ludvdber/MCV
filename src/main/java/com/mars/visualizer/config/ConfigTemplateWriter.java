package com.mars.visualizer.config;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Optional;
import java.util.function.UnaryOperator;

import org.springframework.boot.system.ApplicationHome;

import lombok.extern.slf4j.Slf4j;

/**
 * Depose un modele de configuration A COTE DU JAR quand il n'en existe aucun.
 *
 * <p>Le JAR embarque des valeurs par defaut volontairement inutilisables comme
 * chemins de donnees, et refuse donc de demarrer tant qu'on ne lui a pas dit ou
 * sont les fichiers NetCDF. Le message de refus nomme
 * {@code config/application.properties} — mais sur une installation neuve ce
 * fichier n'existe pas, et rien n'indiquait qu'il fallait le creer ni ce qu'on
 * peut y mettre. Quelqu'un qui telecharge le seul JAR depuis une release lit
 * une consigne qui pointe dans le vide.
 *
 * <p>Le modele ecrit ici EST le fichier {@code config/application.properties}
 * du depot, embarque au build sous le nom {@code config-template.properties}
 * (voir la tache {@code processResources}). Une seule source, donc : ce que
 * l'exploitant trouve sur le disque est exactement ce que la release livre et
 * ce que la documentation decrit.
 *
 * <p><b>A cote du JAR, et non dans le repertoire courant.</b> La premiere
 * version resolvait les chemins contre le repertoire courant, au motif que
 * c'est la que Spring va lire {@code ./config/}. Mesure sur un vrai serveur :
 * {@code java -jar /mnt/data/app/mars-visualizer.jar} lance depuis
 * {@code /root} deposait le modele dans {@code /root/config/}, c'est-a-dire
 * nulle part pour l'exploitant, qui le cherchait evidemment aupres du JAR. Un
 * fichier de configuration appartient a l'application, pas au repertoire d'ou
 * quelqu'un a tape la commande. Le JAR est le seul point fixe.
 *
 * <p>Ecrire la ne suffit pas : Spring ne regarderait toujours que le repertoire
 * courant. {@link com.mars.visualizer.MarsVisualizerApplication} ajoute donc le
 * dossier du JAR aux emplacements de configuration, sans quoi ce fichier serait
 * cree la ou personne ne le lit — pire que le probleme d'origine.
 *
 * <p>Trois precautions. On n'ecrit QUE si aucune configuration externe n'est
 * deja presente (aux deux emplacements, a plat et dans {@code config/}) :
 * ecraser la configuration d'un serveur en production serait un remede pire que
 * le mal. On se tait completement quand les chemins sont deja fournis par la
 * ligne de commande ou par l'environnement, sans quoi un serveur correctement
 * configure lit « Aucune configuration n'a ete trouvee » et une consigne de
 * remplir ce qu'il vient de renseigner. Et l'echec d'ecriture n'est jamais
 * fatal — un service durci, une image conteneur ou un dossier en lecture seule
 * sont des deploiements valides, ou la configuration arrive par variables
 * d'environnement.
 */
@Slf4j
public final class ConfigTemplateWriter {

	/** Le nom que Spring cherche a plat et dans {@code config/}. */
	static final String NOM = "application.properties";

	/** Le gabarit embarque. Ce nom n'est PAS {@code application*.properties} :
	 *  Spring ne le chargerait sinon pas comme un modele mais comme une
	 *  configuration, et ses chemins d'exemple deviendraient actifs. */
	static final String RESSOURCE = "/config-template.properties";

	/** Les deux reglages sans lesquels l'application ne demarre pas. */
	static final String PROP_MEAN = "netcdf.mean.path";
	static final String PROP_INDIVIDUAL = "netcdf.individual.path";
	static final String ENV_MEAN = "NETCDF_MEAN_PATH";
	static final String ENV_INDIVIDUAL = "NETCDF_INDIVIDUAL_PATH";

	private ConfigTemplateWriter() {
	}

	/**
	 * Point d'entree du demarrage.
	 *
	 * @param args les arguments de la ligne de commande, consultes pour savoir
	 *             si l'exploitant a deja renseigne les chemins autrement
	 */
	public static void ecrireSiAbsent(String[] args) {
		ecrireSiAbsent(baseParDefaut(), args, System::getenv);
	}

	/**
	 * Repertoire de reference : celui du JAR quand on tourne depuis un JAR, le
	 * repertoire courant sinon (developpement, tests, classpath eclate), ou
	 * « a cote du JAR » ne veut rien dire.
	 */
	public static Path baseParDefaut() {
		return dossierDuJar().orElseGet(() -> Paths.get(""));
	}

	/**
	 * Le dossier contenant le JAR en cours d'execution, s'il y en a un.
	 *
	 * <p>Ecrit avec {@link ApplicationHome} plutot qu'avec
	 * {@code getProtectionDomain().getCodeSource()}, qui ne marche PAS ici :
	 * dans un JAR Spring Boot les classes vivent sous {@code BOOT-INF/classes},
	 * et le CodeSource rend une URL {@code jar:file:...!/BOOT-INF/classes!/}
	 * dont le protocole n'est pas {@code file}. Mesure faite : la premiere
	 * version retombait silencieusement sur le repertoire courant, exactement le
	 * defaut qu'elle devait corriger. {@code ApplicationHome} sait denouer ces
	 * URL imbriquees — c'est deja lui qui produit le chemin du JAR dans la ligne
	 * « Starting ... (chemin) started by ... in ... » au demarrage.
	 */
	public static Optional<Path> dossierDuJar() {
		try {
			File source = new ApplicationHome(ConfigTemplateWriter.class).getSource();
			// getSource() rend null hors d'un JAR (IDE, tests, classpath eclate),
			// ou « a cote du JAR » ne designe rien.
			return source == null
					? Optional.empty()
					: Optional.ofNullable(source.getParentFile()).map(File::toPath);
		} catch (RuntimeException e) {
			// Chargeur de classes exotique, securite restreinte : on retombe sur
			// le repertoire courant, jamais d'echec au demarrage.
			log.debug("Dossier du JAR indeterminable ({}), repli sur le repertoire courant.", e.toString());
			return Optional.empty();
		}
	}

	/**
	 * @param base        repertoire de reference (celui du JAR en production)
	 * @param args        arguments de la ligne de commande
	 * @param environnement acces aux variables d'environnement
	 * @return le fichier cree, ou vide si une configuration existait deja, si
	 *         elle est fournie autrement, ou si l'ecriture etait impossible
	 */
	static Optional<Path> ecrireSiAbsent(Path base, String[] args, UnaryOperator<String> environnement) {
		Path aPlat = base.resolve(NOM);
		Path dansConfig = base.resolve("config").resolve(NOM);
		if (Files.isRegularFile(aPlat) || Files.isRegularFile(dansConfig)) {
			return Optional.empty();
		}
		if (dejaConfigure(args, environnement)) {
			// L'exploitant a repondu a la question avant qu'on la pose.
			log.debug("Chemins NetCDF fournis par la ligne de commande ou l'environnement :"
					+ " aucun modele de configuration n'est depose.");
			return Optional.empty();
		}

		try (InputStream gabarit = ConfigTemplateWriter.class.getResourceAsStream(RESSOURCE)) {
			if (gabarit == null) {
				log.warn("Gabarit de configuration absent du JAR ({}) : rien n'est ecrit.",
						RESSOURCE);
				return Optional.empty();
			}
			Files.createDirectories(dansConfig.getParent());
			Files.copy(gabarit, dansConfig);
			log.warn(annonce(dansConfig));
			return Optional.of(dansConfig);
		} catch (IOException | RuntimeException e) {
			log.warn("Aucune configuration externe trouvee, et le modele n'a pas pu etre"
					+ " ecrit dans {} ({}). Configurez l'application par variables"
					+ " d'environnement (NETCDF_MEAN_PATH, NETCDF_INDIVIDUAL_PATH).",
					dansConfig.toAbsolutePath(), e.toString());
			return Optional.empty();
		}
	}

	/**
	 * Les deux chemins sont-ils deja fournis par la ligne de commande ou par
	 * l'environnement ?
	 *
	 * <p>On ne cherche pas a reproduire toute la resolution de Spring, qui
	 * n'existe pas encore a ce stade : seulement les deux formes qu'un
	 * exploitant emploie reellement, {@code --netcdf.mean.path=...} et
	 * {@code NETCDF_MEAN_PATH}.
	 */
	static boolean dejaConfigure(String[] args, UnaryOperator<String> environnement) {
		return fourni(PROP_MEAN, ENV_MEAN, args, environnement)
				&& fourni(PROP_INDIVIDUAL, ENV_INDIVIDUAL, args, environnement);
	}

	private static boolean fourni(String propriete, String variable, String[] args,
			UnaryOperator<String> environnement) {
		if (renseignee(environnement.apply(variable))
				|| renseignee(System.getProperty(propriete))) {
			return true;
		}
		if (args == null) {
			return false;
		}
		// Spring accepte les formes relachees : netcdf.mean.path, NETCDF_MEAN_PATH,
		// netcdf_mean_path. On compare donc sur une forme normalisee.
		String cible = normalise(propriete);
		for (String arg : args) {
			if (arg == null || !arg.startsWith("--")) {
				continue;
			}
			int egal = arg.indexOf('=');
			if (egal < 0) {
				continue;
			}
			if (normalise(arg.substring(2, egal)).equals(cible)
					&& renseignee(arg.substring(egal + 1))) {
				return true;
			}
		}
		return false;
	}

	private static String normalise(String cle) {
		return cle.toLowerCase(Locale.ROOT).replace('_', '.').replace('-', '.');
	}

	private static boolean renseignee(String valeur) {
		return valeur != null && !valeur.isBlank();
	}

	/** Le seul texte que lira quelqu'un qui n'a rien lu : il donne le chemin
	 *  absolu, ce qu'il faut y mettre, et quoi faire ensuite. */
	private static String annonce(Path fichier) {
		String ligne = "=".repeat(74);
		return String.format("%n%s%n"
				+ "  Aucune configuration n'a ete trouvee : un modele vient d'etre cree%n"
				+ "  a cote du JAR.%n"
				+ "      %s%n"
				+ "  Renseignez-y netcdf.mean.path et netcdf.individual.path, puis%n"
				+ "  relancez l'application. Le fichier est commente ligne a ligne.%n"
				+ "%n"
				+ "  No configuration was found: a template has just been created next%n"
				+ "  to the JAR, at the path above. Fill in netcdf.mean.path and%n"
				+ "  netcdf.individual.path, then start the application again.%n"
				+ "%s", ligne, fichier.toAbsolutePath(), ligne);
	}
}
