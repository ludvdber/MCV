package com.mars.visualizer.config;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

import lombok.extern.slf4j.Slf4j;

/**
 * Depose un modele de configuration a cote du JAR quand il n'en existe aucun.
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
 * <p>Deux precautions. On n'ecrit QUE si aucune configuration externe n'est
 * deja presente, aux deux emplacements que Spring lit lui-meme ({@code ./} et
 * {@code ./config/}) : ecraser la configuration d'un serveur en production
 * serait un remede pire que le mal. Et l'echec d'ecriture n'est jamais fatal —
 * un service durci, une image conteneur ou un dossier en lecture seule sont des
 * deploiements parfaitement valides, ou la configuration arrive par variables
 * d'environnement. Ajouter ici un motif de panne la ou il n'y en avait pas
 * serait un mauvais echange.
 *
 * <p>Les chemins sont resolus contre le repertoire COURANT, pas contre
 * l'emplacement du JAR : c'est exactement ce que fait Spring pour trouver
 * {@code ./config/}, donc le fichier est ecrit la ou il sera relu.
 */
@Slf4j
public final class ConfigTemplateWriter {

	/** Le nom que Spring cherche dans {@code ./} et dans {@code ./config/}. */
	static final String NOM = "application.properties";

	/** Le gabarit embarque. Ce nom n'est PAS {@code application*.properties} :
	 *  Spring ne le chargerait sinon pas comme un modele mais comme une
	 *  configuration, et ses chemins d'exemple deviendraient actifs. */
	static final String RESSOURCE = "/config-template.properties";

	private ConfigTemplateWriter() {
	}

	/** Point d'entree du demarrage : agit sur le repertoire courant. */
	public static void ecrireSiAbsent() {
		ecrireSiAbsent(Paths.get(""));
	}

	/**
	 * @param base repertoire de reference (le repertoire courant en production)
	 * @return le fichier cree, ou vide si une configuration existait deja ou si
	 *         l'ecriture n'etait pas possible
	 */
	static Optional<Path> ecrireSiAbsent(Path base) {
		Path aPlat = base.resolve(NOM);
		Path dansConfig = base.resolve("config").resolve(NOM);
		if (Files.isRegularFile(aPlat) || Files.isRegularFile(dansConfig)) {
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

	/** Le seul texte que lira quelqu'un qui n'a rien lu : il donne le chemin
	 *  absolu, ce qu'il faut y mettre, et quoi faire ensuite. */
	private static String annonce(Path fichier) {
		String ligne = "=".repeat(74);
		return String.format("%n%s%n"
				+ "  Aucune configuration n'a ete trouvee : un modele vient d'etre cree.%n"
				+ "      %s%n"
				+ "  Renseignez-y netcdf.mean.path et netcdf.individual.path, puis%n"
				+ "  relancez l'application. Le fichier est commente ligne a ligne.%n"
				+ "%n"
				+ "  No configuration was found: a template has just been created at the%n"
				+ "  path above. Fill in netcdf.mean.path and netcdf.individual.path,%n"
				+ "  then start the application again.%n"
				+ "%s", ligne, fichier.toAbsolutePath(), ligne);
	}
}
