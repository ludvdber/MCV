package com.mars.visualizer.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.dto.response.DatasetMetadata;

import ucar.ma2.ArrayFloat;
import ucar.ma2.DataType;
import ucar.nc2.write.NetcdfFormatWriter;

/**
 * Le repertoire MEAN tel qu'il sera reellement.
 *
 * <p>Pendant du test de robustesse cote INDIVIDUAL, ou un seul {@code .nc}
 * inattendu empechait l'application de demarrer. La construction du catalogue
 * MEAN est ecrite plus prudemment — les parseurs de nom rendent {@code null}
 * au lieu de lever, le tri utilise {@code nullsLast}, et chaque fichier est
 * isole dans son propre {@code try} — mais ces proprietes n'etaient affirmees
 * nulle part. Ce sont pourtant les seules qui garantissent qu'un depot de
 * donnees imparfait ne coute pas le service : {@code initCatalog} est ici aussi
 * un {@code @PostConstruct}.
 *
 * <p>Le cas decisif est le fichier qui porte l'extension {@code .nc} sans etre
 * du NetCDF. C'est la bibliotheque ucar qui decide de son sort, et rien ne
 * documentait si elle leve une IOException — rattrapee — ou autre chose, qui
 * traverserait tout. La reponse se mesure, elle ne se suppose pas.
 */
class CatalogServiceRobustesseTest {

	/** Un fichier MEAN minimal mais structurellement valide. */
	private static void ecrireNetCDF(Path chemin) throws Exception {
		NetcdfFormatWriter.Builder b = NetcdfFormatWriter.createNewNetcdf3(chemin.toString());
		b.addDimension("time", 2);
		b.addDimension("lat", 2);
		b.addDimension("lon", 2);
		b.addVariable("TT", DataType.FLOAT, "time lat lon");
		try (NetcdfFormatWriter w = b.build()) {
			w.write(w.findVariable("TT"), new ArrayFloat.D3(2, 2, 2));
		}
	}

	private static CatalogService catalogue(Path mean) {
		DataPathConfig pathConfig = mock(DataPathConfig.class);
		when(pathConfig.getMeanPath()).thenReturn(mean);
		CatalogService s = new CatalogService(pathConfig, new NetCDFReaderService(pathConfig));
		s.initCatalog();
		return s;
	}

	/**
	 * Construit le catalogue en exigeant que rien ne s'en echappe. Le message
	 * nomme la consequence reelle : ici une exception n'est pas un test rouge,
	 * c'est un service qui ne demarre pas.
	 */
	private static CatalogService sansRienLever(Path mean) {
		try {
			return catalogue(mean);
		} catch (RuntimeException e) {
			throw new AssertionError(
					"initCatalog est un @PostConstruct : cette exception empeche l'application "
					+ "de demarrer. " + e.getClass().getSimpleName() + " : " + e.getMessage(), e);
		}
	}

	@Nested
	@DisplayName("Fichiers inattendus dans le repertoire MEAN")
	class FichiersInattendus {

		/**
		 * Le cas qui decide de tout : un fichier porte l'extension mais n'est
		 * pas du NetCDF. Un telechargement interrompu, un fichier de notes
		 * renomme, un export d'un autre outil.
		 */
		@Test
		@DisplayName("Un .nc qui n'est pas du NetCDF est ignore, le reste est indexe")
		void pasDuNetCDF(@TempDir Path mean) throws Exception {
			ecrireNetCDF(mean.resolve("mean_MY28_Ls0_30.nc"));
			Files.writeString(mean.resolve("a-pas-du-netcdf.nc"), "ceci est du texte, pas du binaire");

			CatalogService s = sansRienLever(mean);

			List<DatasetMetadata> c = s.getCatalog();
			assertEquals(1, c.size(), "seul le fichier valide doit etre indexe : " + c);
			assertEquals("mean_MY28_Ls0_30", c.getFirst().id());
		}

		/**
		 * Un fichier vide est le resultat d'un transfert coupe des la premiere
		 * seconde. Il doit couter exactement autant que le precedent : rien.
		 */
		@Test
		@DisplayName("Un .nc vide est ignore sans consequence")
		void fichierVide(@TempDir Path mean) throws Exception {
			ecrireNetCDF(mean.resolve("mean_MY28_Ls0_30.nc"));
			Files.createFile(mean.resolve("a-transfert-coupe.nc"));

			assertEquals(1, sansRienLever(mean).getCatalog().size());
		}

		/**
		 * Le nom ne porte ni annee martienne ni Ls. Les deux parseurs rendent
		 * alors {@code null}, et c'est le tri qui devient le point sensible :
		 * sans {@code nullsLast}, la comparaison leverait une
		 * NullPointerException APRES avoir indexe tous les fichiers, donc au
		 * pire endroit possible.
		 */
		@Test
		@DisplayName("Un NetCDF valide au nom non conforme est indexe et relegue en fin de liste")
		void nomNonConforme(@TempDir Path mean) throws Exception {
			ecrireNetCDF(mean.resolve("mean_MY28_Ls0_30.nc"));
			ecrireNetCDF(mean.resolve("sans_annee_ni_ls.nc"));

			List<DatasetMetadata> c = sansRienLever(mean).getCatalog();

			assertEquals(2, c.size(), "un NetCDF lisible reste utilisable meme mal nomme");
			assertEquals("mean_MY28_Ls0_30", c.getFirst().id(),
					"les entrees sans annee martienne passent en fin de liste");
			assertEquals("sans_annee_ni_ls", c.getLast().id());
			assertNull(c.getLast().marsYear());
		}

		@Test
		@DisplayName("Les fichiers qui ne sont pas des .nc ne sont pas regardes")
		void autresExtensions(@TempDir Path mean) throws Exception {
			ecrireNetCDF(mean.resolve("mean_MY28_Ls0_30.nc"));
			Files.writeString(mean.resolve("README.txt"), "notes de la campagne");
			Files.writeString(mean.resolve("checksums.md5"), "abc123");

			assertEquals(1, sansRienLever(mean).getCatalog().size());
		}

		/**
		 * Cas limite : QUE des fichiers illisibles. Le catalogue doit sortir
		 * vide plutot que de faire echouer le demarrage — l'API repondra alors
		 * une liste vide, ce qui est diagnosticable, la ou un refus de demarrer
		 * ne dit rien de la cause.
		 */
		@Test
		@DisplayName("Un repertoire n'offrant que des fichiers illisibles donne un catalogue vide")
		void tousIllisibles(@TempDir Path mean) throws Exception {
			Files.writeString(mean.resolve("a.nc"), "pas du netcdf");
			Files.writeString(mean.resolve("b.nc"), "pas du netcdf non plus");

			assertTrue(sansRienLever(mean).getCatalog().isEmpty());
		}

		@Test
		@DisplayName("Un repertoire vide donne un catalogue vide, pas une erreur")
		void repertoireVide(@TempDir Path mean) {
			assertTrue(sansRienLever(mean).getCatalog().isEmpty());
		}
	}

	@Nested
	@DisplayName("Ordre du catalogue")
	class Ordre {

		/**
		 * Les noms sortent de la chaine de production sans zero-padding
		 * (Ls0_30, Ls120_150), donc l'ordre alphabetique donnerait
		 * Ls0, Ls120, Ls30. Le tri se fait sur les valeurs PARSEES, et ce test
		 * echouerait si quelqu'un le ramenait un jour a un tri de noms.
		 */
		@Test
		@DisplayName("Le tri suit les valeurs de Ls, pas l'ordre alphabetique des noms")
		void triNumerique(@TempDir Path mean) throws Exception {
			ecrireNetCDF(mean.resolve("mean_MY28_Ls120_150.nc"));
			ecrireNetCDF(mean.resolve("mean_MY28_Ls0_30.nc"));
			ecrireNetCDF(mean.resolve("mean_MY28_Ls30_60.nc"));

			List<String> ids = sansRienLever(mean).getCatalog().stream()
					.map(DatasetMetadata::id).toList();

			assertEquals(List.of("mean_MY28_Ls0_30", "mean_MY28_Ls30_60", "mean_MY28_Ls120_150"),
					ids);
		}

		@Test
		@DisplayName("Les annees martiennes se suivent avant les Ls")
		void triMultiAnnees(@TempDir Path mean) throws Exception {
			ecrireNetCDF(mean.resolve("mean_MY29_Ls0_30.nc"));
			ecrireNetCDF(mean.resolve("mean_MY28_Ls330_360.nc"));

			List<String> ids = sansRienLever(mean).getCatalog().stream()
					.map(DatasetMetadata::id).toList();

			assertEquals(List.of("mean_MY28_Ls330_360", "mean_MY29_Ls0_30"), ids);
		}
	}
}
