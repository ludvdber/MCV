package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.service.IndividualCatalogService;

import tools.jackson.databind.ObjectMapper;

/**
 * L'arborescence individual/ telle qu'elle sera reellement, pas telle qu'on
 * l'imagine.
 *
 * <p>Le poste de developpement n'a qu'un repertoire, peuple par la meme chaine
 * qui a produit les noms. L'IASB en aura plusieurs, remplis au fil des annees,
 * et une arborescence scientifique reelle contient toujours autre chose que ce
 * qu'annonce sa convention : un fichier de notes, un export a l'ancien format,
 * un telechargement interrompu, un repertoire cree d'avance et encore vide.
 *
 * <p>{@code initCatalog} est un {@code @PostConstruct}. Tout ce qui s'en
 * echappe empeche l'application de DEMARRER : le prix d'un fichier inattendu
 * n'est donc pas une entree manquante au catalogue, c'est un service qui ne
 * repond plus du tout. Ces tests fixent la regle inverse : ce qui n'est pas
 * comprehensible est ignore et journalise, le reste continue de fonctionner.
 */
@ExtendWith(MockitoExtension.class)
class IndividualCatalogRobustesseTest {

	@Mock
	private DataPathConfig pathConfig;

	private IndividualCatalogService service(Path racine) {
		when(pathConfig.getIndividualPath()).thenReturn(racine);
		IndividualCatalogService s = new IndividualCatalogService(pathConfig, new ObjectMapper());
		s.initCatalog();
		return s;
	}

	/** Un fichier par Ls demandee, au format {@code hl-b274_NNNNNNp_lsAAA_BBBB.nc}. */
	private void ecrireFichiers(Path dir, double... lsValues) throws IOException {
		Files.createDirectories(dir);
		int seq = 0;
		for (double ls : lsValues) {
			int aaa = (int) Math.floor(ls);
			int bbbb = (int) Math.round((ls - aaa) * 10000);
			Files.writeString(dir.resolve(
					String.format("hl-b274_%06dp_ls%03d_%04d.nc", seq++, aaa, bbbb)), "");
		}
	}

	@Nested
	@DisplayName("Fichiers inattendus")
	class FichiersInattendus {

		/**
		 * Le cas qui coutait le demarrage. {@code parseLsFromFilename} leve une
		 * ValidationException, que la capture du parcours ne retenait pas, et
		 * {@code initCatalog} etant un {@code @PostConstruct}, l'exception
		 * remontait jusqu'au contexte Spring.
		 *
		 * <p>Le nom choisi commence par un « a » : trie avant les vrais
		 * fichiers, il est le premier lu, donc celui dont la Ls est extraite.
		 * Un fichier parasite en fin d'alphabet aurait masque le defaut.
		 */
		@Test
		@DisplayName("Un .nc au nom hors convention n'empeche pas le demarrage")
		void nomHorsConvention(@TempDir Path racine) throws IOException {
			Path bloc = racine.resolve("000001");
			ecrireFichiers(bloc, 10.0, 20.0, 30.0);
			Files.writeString(bloc.resolve("a-notes-de-manip.nc"), "");

			IndividualCatalogService s = assertThatNoExceptionDeLecture(racine);

			assertThat(s.getAvailableYears())
					.as("le catalogue doit rester utilisable malgre le fichier parasite")
					.hasSize(1);
		}

		/**
		 * Le fichier parasite ne doit pas non plus DEFORMER les bornes du bloc :
		 * s'il etait compte, la plage de Ls annoncee serait fausse et la
		 * resolution enverrait vers le mauvais fichier.
		 */
		@Test
		@DisplayName("Le fichier parasite ne deforme pas la plage de Ls du bloc")
		void plageNonDeformee(@TempDir Path racine) throws IOException {
			Path bloc = racine.resolve("000001");
			ecrireFichiers(bloc, 10.0, 20.0, 30.0);
			Files.writeString(bloc.resolve("a-notes-de-manip.nc"), "");

			IndividualCatalogService s = assertThatNoExceptionDeLecture(racine);
			var annee = s.getAvailableYears().getFirst();

			assertThat(annee.lsMin()).as("Ls minimale").isEqualTo(10.0, within(1e-6));
			assertThat(annee.lsMax()).as("Ls maximale").isEqualTo(30.0, within(1e-6));
		}

		@Test
		@DisplayName("La resolution continue de rendre le bon fichier")
		void resolutionIntacte(@TempDir Path racine) throws IOException {
			Path bloc = racine.resolve("000001");
			ecrireFichiers(bloc, 10.0, 20.0, 30.0);
			Files.writeString(bloc.resolve("a-notes-de-manip.nc"), "");

			IndividualCatalogService s = assertThatNoExceptionDeLecture(racine);
			int my = s.getAvailableYears().getFirst().marsYear();

			assertThat(s.findClosestFile(my, 21.0).getFileName().toString())
					.as("le fichier le plus proche de Ls 21 est celui a Ls 20")
					.contains("ls020_0000");
		}

		/**
		 * Les fichiers qui ne sont pas des .nc ne sont deja pas listes. On le
		 * fixe explicitement : c'est ce qui permet de deposer un README ou une
		 * somme de controle a cote des donnees.
		 */
		@Test
		@DisplayName("Les fichiers qui ne sont pas des .nc sont ignores")
		void autresExtensions(@TempDir Path racine) throws IOException {
			Path bloc = racine.resolve("000001");
			ecrireFichiers(bloc, 10.0, 20.0);
			Files.writeString(bloc.resolve("README.txt"), "notes");
			Files.writeString(bloc.resolve("checksums.md5"), "abc");

			IndividualCatalogService s = assertThatNoExceptionDeLecture(racine);
			assertThat(s.getAvailableYears()).hasSize(1);
			assertThat(s.getAvailableYears().getFirst().lsMax()).isEqualTo(20.0, within(1e-6));
		}

		/**
		 * Cas limite du precedent : si AUCUN nom n'est lisible, le bloc n'a plus
		 * de plage de Ls. Il doit disparaitre du catalogue sans emporter le
		 * demarrage ni les autres blocs.
		 */
		@Test
		@DisplayName("Un bloc dont AUCUN nom n'est lisible est ecarte, les autres restent")
		void blocEntierementIllisible(@TempDir Path racine) throws IOException {
			Path illisible = racine.resolve("000001");
			Files.createDirectories(illisible);
			Files.writeString(illisible.resolve("export-ancien-format.nc"), "");
			Files.writeString(illisible.resolve("autre-chose.nc"), "");

			ecrireFichiers(racine.resolve("000002"), 40.0, 50.0);

			IndividualCatalogService s = assertThatNoExceptionDeLecture(racine);
			assertThat(s.getAvailableYears())
					.as("le bloc lisible doit survivre au bloc illisible")
					.isNotEmpty();
			assertThat(s.getAvailableYears().getFirst().lsMin()).isEqualTo(40.0, within(1e-6));
		}
	}

	@Nested
	@DisplayName("Repertoires inattendus")
	class RepertoiresInattendus {

		/**
		 * Un repertoire cree d'avance, pas encore rempli. Il ne doit ni faire
		 * echouer le scan, ni ouvrir une annee martienne vide dans le catalogue.
		 */
		@Test
		@DisplayName("Un sous-repertoire vide est ignore sans consequence")
		void repertoireVide(@TempDir Path racine) throws IOException {
			Files.createDirectories(racine.resolve("000001"));
			ecrireFichiers(racine.resolve("000002"), 40.0, 50.0);

			IndividualCatalogService s = assertThatNoExceptionDeLecture(racine);
			assertThat(s.getAvailableYears()).hasSize(1);
			assertThat(s.getAvailableYears().getFirst().lsMin()).isEqualTo(40.0, within(1e-6));
		}

		/**
		 * Seuls les repertoires au nom entierement numerique sont des blocs de
		 * donnees. Un dossier de travail pose a cote ne doit pas etre lu.
		 */
		@Test
		@DisplayName("Un repertoire au nom non numerique n'est pas parcouru")
		void repertoireNonNumerique(@TempDir Path racine) throws IOException {
			ecrireFichiers(racine.resolve("000001"), 10.0, 20.0);
			Path atelier = racine.resolve("travail-en-cours");
			Files.createDirectories(atelier);
			Files.writeString(atelier.resolve("brouillon.nc"), "");

			IndividualCatalogService s = assertThatNoExceptionDeLecture(racine);
			assertThat(s.getAvailableYears()).hasSize(1);
			assertThat(s.getAvailableYears().getFirst().lsMax()).isEqualTo(20.0, within(1e-6));
		}

		@Test
		@DisplayName("Une arborescence entierement vide donne un catalogue vide, pas une erreur")
		void toutVide(@TempDir Path racine) {
			IndividualCatalogService s = assertThatNoExceptionDeLecture(racine);
			assertThat(s.getAvailableYears()).isEmpty();
		}
	}

	/**
	 * Construit le service en exigeant que le scan ne leve rien. Le message
	 * d'echec nomme la consequence reelle, parce que c'est elle qui compte :
	 * ici une exception n'est pas un test rouge, c'est un service qui ne
	 * demarre pas en production.
	 */
	private IndividualCatalogService assertThatNoExceptionDeLecture(Path racine) {
		try {
			return service(racine);
		} catch (RuntimeException e) {
			throw new AssertionError(
					"initCatalog est un @PostConstruct : cette exception empeche l'application "
					+ "de demarrer. " + e.getClass().getSimpleName() + " : " + e.getMessage(), e);
		}
	}
}
