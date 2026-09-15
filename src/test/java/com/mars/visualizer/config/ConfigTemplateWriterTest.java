package com.mars.visualizer.config;

import static org.assertj.core.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Le modele de configuration depose au premier demarrage.
 *
 * <p>Il repond a un defaut d'usage precis : le JAR refusait de demarrer en
 * nommant {@code config/application.properties}, un fichier qui n'existait pas
 * encore et dont rien ne disait le contenu. Quelqu'un qui telecharge le seul
 * JAR depuis une release lisait donc une consigne pointant dans le vide.
 *
 * <p>Deux proprietes comptent plus que la creation elle-meme, et ce sont
 * celles-la qui sont fixees ici. On n'ECRASE JAMAIS une configuration
 * existante — le contraire effacerait celle d'un serveur en production au
 * redemarrage suivant, ce qui serait un remede pire que le mal. Et une
 * ecriture impossible n'est JAMAIS fatale : un service durci, une image
 * conteneur ou un dossier en lecture seule sont des deploiements valables, ou
 * la configuration arrive par variables d'environnement. Ajouter un motif de
 * panne la ou il n'y en avait pas serait un mauvais echange.
 */
class ConfigTemplateWriterTest {

	private static Path dansConfig(Path base) {
		return base.resolve("config").resolve("application.properties");
	}

	@Nested
	@DisplayName("Installation neuve")
	class InstallationNeuve {

		@Test
		@DisplayName("Un dossier ne contenant que le JAR recoit le modele")
		void deposeLeModele(@TempDir Path base) {
			Optional<Path> ecrit = ConfigTemplateWriter.ecrireSiAbsent(base);

			assertThat(ecrit).isPresent();
			assertThat(dansConfig(base)).exists();
		}

		/**
		 * Le modele n'est pas un fichier vide poli : c'est le
		 * {@code config/application.properties} du depot, embarque au build. Ce
		 * qu'on trouve sur le disque doit donc etre ce que la release livre et
		 * ce que la documentation decrit — sinon la generation cree une
		 * troisieme version a maintenir.
		 */
		@Test
		@DisplayName("Le modele porte bien les cles a renseigner et leurs commentaires")
		void contenuUtile(@TempDir Path base) throws Exception {
			ConfigTemplateWriter.ecrireSiAbsent(base);
			String contenu = Files.readString(dansConfig(base));

			assertThat(contenu)
					.as("les deux cles sans lesquelles l'application refuse de demarrer")
					.contains("netcdf.mean.path")
					.contains("netcdf.individual.path");
			assertThat(contenu)
					.as("un modele sans explication ne vaut pas mieux qu'un fichier absent")
					.contains("Mars Climate Viewer");
			assertThat(contenu.lines().filter(l -> l.startsWith("#")).count())
					.as("le fichier doit etre commente ligne a ligne")
					.isGreaterThan(30);
		}

		/**
		 * Le modele porte les chemins d'exemple, pas des valeurs vides : une
		 * case vide passait les gardes de DataPathConfig et faisait demarrer
		 * l'application sur le dossier du JAR. Voir DataPathConfigTest.
		 */
		@Test
		@DisplayName("Le modele ne propose aucun chemin VIDE")
		void aucuneValeurVide(@TempDir Path base) throws Exception {
			ConfigTemplateWriter.ecrireSiAbsent(base);

			assertThat(Files.readAllLines(dansConfig(base)))
					.filteredOn(l -> l.startsWith("netcdf.mean.path")
							|| l.startsWith("netcdf.individual.path"))
					.isNotEmpty()
					.allSatisfy(l -> assertThat(l.substring(l.indexOf('=') + 1).trim())
							.as("une valeur vide est un oubli qui demarre quand meme")
							.isNotEmpty());
		}
	}

	@Nested
	@DisplayName("Une configuration existante est intouchable")
	class JamaisEcraser {

		@Test
		@DisplayName("Un fichier deja present dans config/ est laisse tel quel")
		void configDejaLa(@TempDir Path base) throws Exception {
			Files.createDirectories(base.resolve("config"));
			Files.writeString(dansConfig(base), "netcdf.mean.path=/donnees/production");

			assertThat(ConfigTemplateWriter.ecrireSiAbsent(base)).isEmpty();
			assertThat(Files.readString(dansConfig(base)))
					.as("ecraser la configuration d'un serveur au redemarrage serait pire que le mal")
					.isEqualTo("netcdf.mean.path=/donnees/production");
		}

		/**
		 * Spring lit {@code ./} AVANT {@code ./config/}. Une configuration
		 * posee a plat a cote du JAR est donc active, et generer un second
		 * fichier dans {@code config/} ne serait pas neutre : il l'emporterait
		 * au demarrage suivant et remplacerait silencieusement la
		 * configuration en service par des chemins d'exemple.
		 */
		@Test
		@DisplayName("Un fichier pose A PLAT a cote du JAR compte aussi")
		void fichierAPlat(@TempDir Path base) throws Exception {
			Files.writeString(base.resolve("application.properties"),
					"netcdf.mean.path=/donnees/production");

			assertThat(ConfigTemplateWriter.ecrireSiAbsent(base)).isEmpty();
			assertThat(base.resolve("config")).doesNotExist();
		}
	}

	/**
	 * Le fichier de configuration ne sert a rien si l'unite de service le
	 * court-circuite.
	 *
	 * <p>Spring donne la priorite aux variables d'environnement sur le fichier
	 * externe. Mesure faite : fichier et variable pointant vers deux dossiers
	 * differents, c'est la VARIABLE qui est validee au demarrage. L'unite
	 * livree posait justement NETCDF_MEAN_PATH et NETCDF_INDIVIDUAL_PATH, si
	 * bien qu'un exploitant pouvait remplir correctement
	 * config/application.properties, redemarrer, et ne rien voir changer — le
	 * message d'erreur lui designant alors un fichier deja juste.
	 *
	 * <p>Ce test lit le fichier reellement livre. Il echouera si quelqu'un
	 * decommente ces lignes sans mesurer la consequence.
	 */
	@Nested
	@DisplayName("L'unite systemd livree n'annule pas le fichier de configuration")
	class UniteDeService {

		private static final Path UNITE = Path.of("deploy", "mcv.service");

		@Test
		@DisplayName("Les chemins de donnees ne sont pas imposes par variable d'environnement")
		void pasDeSurchargeDesChemins() throws Exception {
			assertThat(UNITE).as("l'unite livree doit exister").exists();

			List<String> actives = Files.readAllLines(UNITE).stream()
					.map(String::trim)
					.filter(l -> l.startsWith("Environment="))
					.filter(l -> l.contains("NETCDF_MEAN_PATH") || l.contains("NETCDF_INDIVIDUAL_PATH"))
					.toList();

			assertThat(actives)
					.as("une variable d'environnement l'emporte sur config/application.properties :"
							+ " ces lignes rendraient le fichier inerte, en silence")
					.isEmpty();
		}

		/** Le sujet doit rester EXPLIQUE dans l'unite, pas seulement absent. */
		@Test
		@DisplayName("L'unite explique ou se configurent les chemins")
		void expliqueOuConfigurer() throws Exception {
			String texte = Files.readString(UNITE);
			assertThat(texte)
					.as("l'exploitant doit lire dans l'unite ou remplir les chemins")
					.contains("config/application.properties");
		}
	}

	@Nested
	@DisplayName("Une ecriture impossible ne fait pas tomber le demarrage")
	class EcritureImpossible {

		/**
		 * Un fichier nomme {@code config} bloque la creation du repertoire :
		 * c'est la facon portable de provoquer l'echec d'ecriture que
		 * produiraient un dossier en lecture seule ou un service durci.
		 */
		@Test
		@DisplayName("Le chemin obstrue rend un resultat vide, pas une exception")
		void chemineObstrue(@TempDir Path base) throws Exception {
			Files.writeString(base.resolve("config"), "ceci est un fichier, pas un dossier");

			assertThatNoException()
					.as("la generation est un confort : elle ne doit ajouter aucun mode de panne")
					.isThrownBy(() -> assertThat(ConfigTemplateWriter.ecrireSiAbsent(base)).isEmpty());
		}
	}
}
