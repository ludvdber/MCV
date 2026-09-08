package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.FileTime;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.IndividualCatalogService;

import tools.jackson.databind.ObjectMapper;

/**
 * Resolution d'un fichier individuel a partir d'une annee martienne et d'une Ls.
 *
 * <p>{@code findClosestFile} n'avait AUCUN test : c'est pourtant elle qui decide
 * quel fichier repond a chaque requete sur un jeu individuel, soit 960 fichiers
 * sur les 972 du jeu de donnees.
 *
 * <p>Le cas le plus important ici est la PORTABILITE du cache. Le catalogue est
 * persiste dans {@code .catalog-cache.json}, a l'interieur meme du dossier
 * {@code individual/}, et ce fichier voyage donc avec les donnees. L'empreinte
 * qui le valide ne retient que le nom et la date de chaque sous-repertoire :
 * deplacer l'arborescence ne la change pas.
 */
@ExtendWith(MockitoExtension.class)
class IndividualCatalogResolutionTest {

	private static final String CACHE = ".catalog-cache.json";
	private static final long   DATE  = 1_000_000_000_000L;

	@Mock
	private DataPathConfig pathConfig;

	private final ObjectMapper objectMapper = new ObjectMapper();

	private IndividualCatalogService nouveauService() {
		return new IndividualCatalogService(pathConfig, objectMapper);
	}

	/** Ecrit un fichier par Ls demande, au format {@code lsAAA_BBBB}. */
	private void ecrireFichiers(Path dir, double... lsValues) throws IOException {
		Files.createDirectories(dir);
		int seq = 0;
		for (double ls : lsValues) {
			int aaa  = (int) Math.floor(ls);
			int bbbb = (int) Math.round((ls - aaa) * 10000);
			Files.writeString(dir.resolve(
					String.format("hl-b274_%06dp_ls%03d_%04d.nc", seq++, aaa, bbbb)), "");
		}
	}

	private void dater(Path dir, long millis) throws IOException {
		Files.setLastModifiedTime(dir, FileTime.fromMillis(millis));
	}

	/** L'annee martienne reelle du catalogue : {@code my_base} n'est pas injecte hors Spring. */
	private int premiereAnnee(IndividualCatalogService s) {
		return s.getAvailableYears().getFirst().marsYear();
	}

	// =========================================================================
	// Portabilite du cache
	// =========================================================================

	@Nested
	@DisplayName("cache et déplacement des données")
	class Portabilite {

		@Test
		@DisplayName("le catalogue survit au déplacement du dossier individual/")
		void survitAuDeplacement(@TempDir Path depart, @TempDir Path arrivee) throws IOException {
			// C'est exactement le trajet de livraison : le dossier individual/
			// est copie du poste de developpement vers le serveur de l'institut,
			// avec son .catalog-cache.json dedans et les dates preservees.
			when(pathConfig.getIndividualPath()).thenReturn(depart);
			ecrireFichiers(depart.resolve("000960"), 0.0, 5.0, 10.0);
			dater(depart.resolve("000960"), DATE);

			IndividualCatalogService avant = nouveauService();
			avant.initCatalog();
			int annee = premiereAnnee(avant);
			assertThat(avant.findClosestFile(annee, 5.0)).exists();

			// Deplacement du sous-repertoire ET du cache, dates conservees.
			Files.move(depart.resolve("000960"), arrivee.resolve("000960"));
			Files.move(depart.resolve(CACHE), arrivee.resolve(CACHE),
					StandardCopyOption.REPLACE_EXISTING);

			// Marqueur qui distingue les deux issues : on retire le fichier
			// Ls=10 SANS toucher a la date du repertoire. Si le cache est
			// reutilise, l'annee monte toujours a 10 ; s'il a ete rescanne, elle
			// s'arrete a 5. Sans ce marqueur, le test passerait aussi bien dans
			// le cas ou le cache est ignore, et ne prouverait donc rien.
			Files.delete(arrivee.resolve("000960").resolve("hl-b274_000002p_ls010_0000.nc"));
			dater(arrivee.resolve("000960"), DATE);

			when(pathConfig.getIndividualPath()).thenReturn(arrivee);
			IndividualCatalogService apres = nouveauService();
			apres.initCatalog();

			// L'empreinte ne voit que « 000960 » et sa date : elle correspond
			// toujours, donc le cache est accepte tel quel. S'il porte le chemin
			// ABSOLU d'origine, chaque requete pointe vers un dossier disparu.
			assertThat(apres.getAvailableYears())
					.as("le cache est bien reutilise, l'empreinte n'a pas change")
					.hasSize(1);
			assertThat(apres.getAvailableYears().getFirst().lsMax())
					.as("Ls max = 10 prouve que le catalogue vient du CACHE et non d'un rescan")
					.isCloseTo(10.0, within(1e-6));

			Path resolu = apres.findClosestFile(premiereAnnee(apres), 5.0);
			assertThat(resolu)
					.as("le fichier resolu doit exister a la NOUVELLE adresse")
					.exists();
			assertThat(resolu.toAbsolutePath())
					.as("il doit etre cherche sous la racine configuree, pas sous l'ancienne")
					.startsWith(arrivee.toAbsolutePath());
		}

		@Test
		@DisplayName("le cache écrit ne fige aucun chemin absolu")
		void aucunCheminAbsoluDansLeCache(@TempDir Path root) throws IOException {
			// Un chemin absolu dans un fichier livre a l'institut est a la fois
			// une source de panne et une fuite du repertoire personnel du poste
			// de developpement.
			when(pathConfig.getIndividualPath()).thenReturn(root);
			ecrireFichiers(root.resolve("000960"), 0.0, 10.0);
			nouveauService().initCatalog();

			String json = Files.readString(root.resolve(CACHE));
			assertThat(json)
					.as("le cache doit rester independant de l'endroit ou vivent les donnees")
					.doesNotContain(root.toAbsolutePath().toString().replace("\\", "\\\\"))
					.doesNotContain(root.toAbsolutePath().toString());
		}

		@Test
		@DisplayName("un cache à l’ancien format, avec chemin figé, ne casse pas le démarrage")
		void ancienFormatSeRepareToutSeul(@TempDir Path root) throws IOException {
			// Les caches deja ecrits sur disque portent un champ dirPath.
			// Mesure : Jackson l'ignore, le catalogue se charge normalement et
			// le chemin est reconstruit sous la racine configuree. Le fichier
			// n'est PAS reecrit pour autant, puisqu'il n'est sauvegarde qu'apres
			// un vrai rescan : le champ perime reste donc sur disque, inerte,
			// jusqu'au prochain changement du dossier. C'est sans consequence,
			// mais il faut le savoir plutot que de le croire nettoye.
			when(pathConfig.getIndividualPath()).thenReturn(root);
			ecrireFichiers(root.resolve("000960"), 0.0, 5.0, 10.0);
			dater(root.resolve("000960"), DATE);

			String ancien = """
					{"signature":"000960:%d",\
					"yearInfos":[{"marsYear":34,"lsMin":0.0,"lsMax":10.0,"directories":["000960"]}],\
					"dirInfos":[{"dirName":"000960","dirPath":"C:\\\\ancienne\\\\machine\\\\000960",\
					"lsMin":0.0,"lsMax":10.0,"marsYear":34}]}""".formatted(DATE);
			Files.writeString(root.resolve(CACHE), ancien);
			dater(root.resolve("000960"), DATE);

			IndividualCatalogService s = nouveauService();
			s.initCatalog();

			assertThat(s.getAvailableYears()).isNotEmpty();
			Path resolu = s.findClosestFile(premiereAnnee(s), 5.0);
			assertThat(resolu)
					.as("le fichier doit etre cherche sous la racine configuree")
					.exists();
			assertThat(resolu.toAbsolutePath())
					.as("et surtout PAS sous le chemin fige que porte encore le cache")
					.startsWith(root.toAbsolutePath());
		}
	}

	// =========================================================================
	// findClosestFile
	// =========================================================================

	@Nested
	@DisplayName("findClosestFile")
	class Resolution {

		@Test
		@DisplayName("rend le fichier dont la Ls est la plus proche de la cible")
		void plusProcheVoisin(@TempDir Path root) throws IOException {
			when(pathConfig.getIndividualPath()).thenReturn(root);
			ecrireFichiers(root.resolve("000960"), 0.0, 2.0, 4.0, 6.0);
			IndividualCatalogService s = nouveauService();
			s.initCatalog();
			int my = premiereAnnee(s);

			assertThat(s.findClosestFile(my, 3.9).getFileName().toString()).contains("ls004_0000");
			assertThat(s.findClosestFile(my, 2.9).getFileName().toString()).contains("ls002_0000");
			assertThat(s.getActualLs(s.findClosestFile(my, 3.9))).isCloseTo(4.0, within(1e-6));
		}

		@Test
		@DisplayName("une cible hors des bornes retombe sur l’extrémité la plus proche")
		void horsBornes(@TempDir Path root) throws IOException {
			when(pathConfig.getIndividualPath()).thenReturn(root);
			ecrireFichiers(root.resolve("000960"), 10.0, 20.0, 30.0);
			IndividualCatalogService s = nouveauService();
			s.initCatalog();
			int my = premiereAnnee(s);

			assertThat(s.getActualLs(s.findClosestFile(my, 0.0))).isCloseTo(10.0, within(1e-6));
			assertThat(s.getActualLs(s.findClosestFile(my, 359.0))).isCloseTo(30.0, within(1e-6));
		}

		@Test
		@DisplayName("choisit le bon bloc quand l’année couvre plusieurs répertoires")
		void choisitLeBonRepertoire(@TempDir Path root) throws IOException {
			when(pathConfig.getIndividualPath()).thenReturn(root);
			ecrireFichiers(root.resolve("000960"), 0.0, 5.0, 10.0);
			ecrireFichiers(root.resolve("001920"), 20.0, 25.0, 30.0);
			IndividualCatalogService s = nouveauService();
			s.initCatalog();
			int my = premiereAnnee(s);

			assertThat(s.findClosestFile(my, 24.0).getParent().getFileName().toString())
					.as("Ls 24 appartient au second bloc")
					.isEqualTo("001920");
			assertThat(s.findClosestFile(my, 4.0).getParent().getFileName().toString())
					.isEqualTo("000960");
			// Entre les deux blocs : 10 est a 5 d'ecart, 20 a 5 aussi ; le
			// premier trouve l'emporte, ce qui est stable et suffit ici.
			assertThat(s.findClosestFile(my, 12.0).getParent().getFileName().toString())
					.as("Ls 12 est plus proche du premier bloc")
					.isEqualTo("000960");
		}

		@Test
		@DisplayName("refuse une année martienne absente du catalogue")
		void anneeInconnue(@TempDir Path root) throws IOException {
			when(pathConfig.getIndividualPath()).thenReturn(root);
			ecrireFichiers(root.resolve("000960"), 0.0, 10.0);
			IndividualCatalogService s = nouveauService();
			s.initCatalog();

			assertThatThrownBy(() -> s.findClosestFile(premiereAnnee(s) + 99, 5.0))
					.isInstanceOf(ValidationException.class);
		}
	}

	// =========================================================================
	// Lecture de la Ls dans le nom de fichier
	// =========================================================================

	@Nested
	@DisplayName("getActualLs")
	class LectureLs {

		@Test
		@DisplayName("compose la Ls à partir des deux groupes du nom")
		void composeLaLs(@TempDir Path root) {
			// Ls = AAA + BBBB / 10000 : ls001_0100 vaut 1,01 et non 1,0100.
			// Aucun acces disque ici : la Ls est lue dans le NOM du fichier.
			IndividualCatalogService s = nouveauService();

			assertThat(s.getActualLs(root.resolve("hl-b274_000050p_ls001_0100.nc")))
					.isCloseTo(1.01, within(1e-9));
			assertThat(s.getActualLs(root.resolve("hl-b274_000000p_ls000_0000.nc")))
					.isCloseTo(0.0, within(1e-9));
			assertThat(s.getActualLs(root.resolve("hl-b274_000959p_ls010_0900.nc")))
					.as("derniere valeur du bloc reel livre par la pipeline")
					.isCloseTo(10.09, within(1e-9));
		}

		@Test
		@DisplayName("ramène Ls 360 à 0, comme le documente le service")
		void ls360Vaut0(@TempDir Path root) {
			IndividualCatalogService s = nouveauService();
			assertThat(s.getActualLs(root.resolve("hl-b274_000000p_ls360_0000.nc")))
					.as("Ls 360 est le meme instant que Ls 0")
					.isCloseTo(0.0, within(1e-9));
		}

		@Test
		@DisplayName("refuse un nom qui ne porte pas le motif attendu")
		void nomIllisible(@TempDir Path root) {
			IndividualCatalogService s = nouveauService();
			assertThatThrownBy(() -> s.getActualLs(root.resolve("donnees.nc")))
					.isInstanceOf(ValidationException.class);
		}
	}

	// =========================================================================
	// Deduction de l'annee martienne
	// =========================================================================

	@Nested
	@DisplayName("détection de l’année martienne")
	class AnneeMartienne {

		@Test
		@DisplayName("un retour en arrière de la Ls entre deux blocs ouvre une année")
		void reculEntreBlocs(@TempDir Path root) throws IOException {
			// Le second bloc repart de Ls 5 apres un premier fini a 350 : c'est
			// un changement d'annee, pas un desordre.
			when(pathConfig.getIndividualPath()).thenReturn(root);
			ecrireFichiers(root.resolve("000960"), 340.0, 350.0);
			ecrireFichiers(root.resolve("001920"), 5.0, 15.0);
			IndividualCatalogService s = nouveauService();
			s.initCatalog();

			assertThat(s.getAvailableYears()).hasSize(2);
			assertThat(s.getAvailableYears().get(1).marsYear())
					.isEqualTo(s.getAvailableYears().get(0).marsYear() + 1);
		}

		@Test
		@DisplayName("un léger chevauchement entre blocs n’ouvre PAS une année")
		void chevauchementLegerNeComptePas(@TempDir Path root) throws IOException {
			// Le seuil est de 180 degres : un bloc qui recommence quelques
			// degres en arriere reste dans la meme annee.
			when(pathConfig.getIndividualPath()).thenReturn(root);
			ecrireFichiers(root.resolve("000960"), 100.0, 110.0);
			ecrireFichiers(root.resolve("001920"), 108.0, 120.0);
			IndividualCatalogService s = nouveauService();
			s.initCatalog();

			assertThat(s.getAvailableYears())
					.as("un recul de 2 degres n'est pas un changement d'annee")
					.hasSize(1);
		}

		@Test
		@DisplayName("un bloc qui enjambe la fin d’année est partagé entre deux années")
		void blocAChevalSurDeuxAnnees(@TempDir Path root) throws IOException {
			when(pathConfig.getIndividualPath()).thenReturn(root);
			ecrireFichiers(root.resolve("000960"), 350.0, 355.0, 3.0, 8.0);
			IndividualCatalogService s = nouveauService();
			s.initCatalog();

			assertThat(s.getAvailableYears())
					.as("le meme repertoire porte la fin d'une annee et le debut de la suivante")
					.hasSize(2);
			assertThat(s.getAvailableYears().get(0).directories()).containsExactly("000960");
			assertThat(s.getAvailableYears().get(1).directories()).containsExactly("000960");
		}
	}
}
