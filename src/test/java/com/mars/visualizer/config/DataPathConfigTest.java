package com.mars.visualizer.config;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Le garde-fou de demarrage.
 *
 * <p>C'est la seule chose qui empeche l'application de demarrer sur une
 * configuration fausse. Si elle laisse passer un chemin invalide, le service
 * demarre, sert un catalogue vide, et l'exploitant cherche la panne du cote du
 * reseau ou des donnees pendant que la cause tient en une ligne de properties.
 * Le message d'erreur fait donc partie du contrat autant que le refus lui-meme :
 * il doit nommer la propriete ET la variable d'environnement equivalente, parce
 * que le deploiement peut utiliser l'une ou l'autre.
 *
 * <p>Les chemins colles depuis un explorateur Windows ou un shell arrivent
 * souvent entoures de guillemets et d'espaces. Les accepter n'est pas une
 * coquetterie : sans cela, l'echec ressemble a « repertoire introuvable » alors
 * que le chemin est bon, et personne ne pense a regarder les guillemets.
 */
class DataPathConfigTest {

	/**
	 * La classe est un bean Spring dont les deux chaines viennent de
	 * {@code @Value}. On les pose directement : cela evite de demarrer un
	 * contexte complet pour observer une validation de quelques lignes.
	 */
	private static DataPathConfig configuree(String mean, String individual) {
		DataPathConfig c = new DataPathConfig();
		ReflectionTestUtils.setField(c, "meanPathString", mean);
		ReflectionTestUtils.setField(c, "individualPathString", individual);
		return c;
	}

	@Nested
	@DisplayName("Configuration valide")
	class Valide {

		@Test
		@DisplayName("Deux repertoires existants sont acceptes et exposes")
		void deuxRepertoires(@TempDir Path racine) throws IOException {
			Path mean = Files.createDirectory(racine.resolve("mean"));
			Path individual = Files.createDirectory(racine.resolve("individual"));

			DataPathConfig c = configuree(mean.toString(), individual.toString());
			assertDoesNotThrow(c::initialize);

			assertEquals(mean, c.getMeanPath());
			assertEquals(individual, c.getIndividualPath());
		}

		@Test
		@DisplayName("Les espaces autour du chemin sont ignores")
		void espaces(@TempDir Path racine) throws IOException {
			Path mean = Files.createDirectory(racine.resolve("mean"));
			Path individual = Files.createDirectory(racine.resolve("individual"));

			DataPathConfig c = configuree("  " + mean + "  ", "\t" + individual + " ");
			assertDoesNotThrow(c::initialize);
			assertEquals(mean, c.getMeanPath());
			assertEquals(individual, c.getIndividualPath());
		}

		@Test
		@DisplayName("Les guillemets doubles d'encadrement sont retires")
		void guillemetsDoubles(@TempDir Path racine) throws IOException {
			Path mean = Files.createDirectory(racine.resolve("mean"));
			Path individual = Files.createDirectory(racine.resolve("individual"));

			DataPathConfig c = configuree("\"" + mean + "\"", "\"" + individual + "\"");
			assertDoesNotThrow(c::initialize);
			assertEquals(mean, c.getMeanPath());
		}

		@Test
		@DisplayName("Les apostrophes d'encadrement sont retirees")
		void apostrophes(@TempDir Path racine) throws IOException {
			Path mean = Files.createDirectory(racine.resolve("mean"));
			Path individual = Files.createDirectory(racine.resolve("individual"));

			DataPathConfig c = configuree("'" + mean + "'", "'" + individual + "'");
			assertDoesNotThrow(c::initialize);
			assertEquals(mean, c.getMeanPath());
		}

		@Test
		@DisplayName("Guillemets ET espaces combines, le cas du copier-coller")
		void guillemetsEtEspaces(@TempDir Path racine) throws IOException {
			Path mean = Files.createDirectory(racine.resolve("mean"));
			Path individual = Files.createDirectory(racine.resolve("individual"));

			DataPathConfig c = configuree("  \" " + mean + " \"  ", individual.toString());
			assertDoesNotThrow(c::initialize);
			assertEquals(mean, c.getMeanPath());
		}

		/**
		 * Un guillemet d'un seul cote n'encadre rien : c'est un caractere du
		 * chemin, pas une decoration. Le retirer transformerait une faute de
		 * frappe en chemin different, donc en erreur plus difficile a lire.
		 *
		 * <p>Les deux systemes echouent pour des raisons differentes, et c'est
		 * la raison d'etre de ce test. Windows refuse le guillemet dans un
		 * chemin : Paths.get leve une InvalidPathException, qui remontait telle
		 * quelle et privait l'exploitant de toute indication. Linux accepte ce
		 * caractere dans un nom de fichier, donc le chemin est construit puis
		 * declare introuvable. On exige desormais la meme chose des deux cotes :
		 * un refus de demarrage portant le message d'aide.
		 */
		@Test
		@DisplayName("Un guillemet d'un seul cote est refuse avec un message exploitable")
		void guillemetDepareille(@TempDir Path racine) throws IOException {
			Path mean = Files.createDirectory(racine.resolve("mean"));
			DataPathConfig c = configuree("\"" + mean, racine.toString());

			IllegalStateException e = assertThrows(IllegalStateException.class, c::initialize);
			String m = e.getMessage();
			assertTrue(m.contains("netcdf.mean.path"),
					"le refus doit rester exploitable quel que soit le systeme : " + m);
			assertTrue(m.contains("NETCDF_MEAN_PATH"), m);
		}
	}

	@Nested
	@DisplayName("Refus de demarrage")
	class Refus {

		@Test
		@DisplayName("Un repertoire MEAN inexistant arrete le demarrage")
		void meanInexistant(@TempDir Path racine) throws IOException {
			Path individual = Files.createDirectory(racine.resolve("individual"));
			Path absent = racine.resolve("pas-la");

			DataPathConfig c = configuree(absent.toString(), individual.toString());
			IllegalStateException e = assertThrows(IllegalStateException.class, c::initialize);

			assertTrue(e.getMessage().contains("MEAN"), e.getMessage());
			assertTrue(e.getMessage().contains("pas-la"), "le chemin fautif doit etre nomme");
		}

		@Test
		@DisplayName("Un repertoire individual inexistant arrete aussi le demarrage")
		void individualInexistant(@TempDir Path racine) throws IOException {
			Path mean = Files.createDirectory(racine.resolve("mean"));
			Path absent = racine.resolve("pas-la-non-plus");

			DataPathConfig c = configuree(mean.toString(), absent.toString());
			IllegalStateException e = assertThrows(IllegalStateException.class, c::initialize);

			assertTrue(e.getMessage().contains("individual"), e.getMessage());
			assertTrue(e.getMessage().contains("pas-la-non-plus"), e.getMessage());
		}

		/**
		 * Cas reel : on pointe le fichier au lieu du dossier qui le contient.
		 * Sans ce controle, l'erreur ne surviendrait qu'au premier parcours du
		 * catalogue, loin de sa cause.
		 */
		@Test
		@DisplayName("Un chemin qui designe un fichier et non un repertoire est refuse")
		void fichierAuLieuDeRepertoire(@TempDir Path racine) throws IOException {
			Path individual = Files.createDirectory(racine.resolve("individual"));
			Path fichier = Files.createFile(racine.resolve("donnees.nc"));

			DataPathConfig c = configuree(fichier.toString(), individual.toString());
			IllegalStateException e = assertThrows(IllegalStateException.class, c::initialize);

			assertTrue(e.getMessage().contains("n'est pas un répertoire"), e.getMessage());
			assertTrue(e.getMessage().contains("donnees.nc"), e.getMessage());
		}

		/**
		 * Le message est la seule chose que l'exploitant verra. Il doit porter
		 * de quoi agir : la cle de propriete, la variable d'environnement, et
		 * l'endroit ou poser le fichier.
		 */
		@Test
		@DisplayName("Le message dit quoi corriger et ou")
		void messageActionnable(@TempDir Path racine) throws IOException {
			Files.createDirectory(racine.resolve("individual"));
			DataPathConfig c = configuree(racine.resolve("absent").toString(),
					racine.resolve("individual").toString());

			IllegalStateException e = assertThrows(IllegalStateException.class, c::initialize);
			String m = e.getMessage();

			assertTrue(m.contains("netcdf.mean.path"), "la cle de propriete doit figurer : " + m);
			assertTrue(m.contains("NETCDF_MEAN_PATH"),
					"la variable d'environnement equivalente doit figurer : " + m);
			assertTrue(m.contains("config/application.properties"),
					"l'emplacement du fichier doit figurer : " + m);
		}

		@Test
		@DisplayName("Le message du repertoire individual nomme sa propre propriete")
		void messageIndividual(@TempDir Path racine) throws IOException {
			Files.createDirectory(racine.resolve("mean"));
			DataPathConfig c = configuree(racine.resolve("mean").toString(),
					racine.resolve("absent").toString());

			String m = assertThrows(IllegalStateException.class, c::initialize).getMessage();
			assertTrue(m.contains("netcdf.individual.path"), m);
			assertTrue(m.contains("NETCDF_INDIVIDUAL_PATH"), m);
		}

		/**
		 * MEAN est valide en premier : son echec doit interrompre avant que
		 * individual ne soit seulement regarde, sinon le message nommerait la
		 * mauvaise propriete.
		 */
		@Test
		@DisplayName("Les deux chemins fautifs : c'est MEAN qui est signale")
		void ordreDeValidation(@TempDir Path racine) {
			DataPathConfig c = configuree(racine.resolve("ni-lun").toString(),
					racine.resolve("ni-lautre").toString());

			String m = assertThrows(IllegalStateException.class, c::initialize).getMessage();
			assertTrue(m.contains("MEAN"), m);
			assertFalse(m.contains("ni-lautre"), "le second chemin ne doit pas etre atteint");
		}
	}
}
