package com.mars.visualizer;

import static org.junit.jupiter.api.Assertions.*;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.util.StatsCalculator;

/**
 * Les nombres imprimes sous chaque carte.
 *
 * <p>{@code StatsCalculatorTest} couvre les cas courants. Celui-ci vise ce qui
 * reste : les valeurs exactes de l'ecart-type et de la mediane <b>ponderes</b>,
 * les gardes qui evitent qu'une latitude aberrante corrompe la moyenne, et les
 * chemins de repli. Ce sont des chiffres qu'un lecteur croira sur parole, donc
 * les attendus sont calcules a la main plutot que releves sur une execution :
 * un attendu copie depuis la sortie du code ne prouve que sa stabilite, jamais
 * sa justesse.
 *
 * <h2>Le jeu de reference</h2>
 * Trois rangees de deux cellules, aux latitudes 0, 60 et -60 degres, donc de
 * poids cos = 1, 0,5 et 0,5.
 * <pre>
 *   lat   0 :  10  10     poids 1
 *   lat  60 :  20  20     poids 0,5
 *   lat -60 :  30  30     poids 0,5
 * </pre>
 * somme ponderee = 1x20 + 0,5x40 + 0,5x60 = 70, poids total = 4,
 * donc moyenne ponderee = <b>17,5</b> la ou la moyenne brute vaut <b>20</b>.
 * L'ecart entre les deux est tout l'interet de la ponderation : une cellule
 * proche du pole couvre une surface bien plus petite qu'une cellule a
 * l'equateur, et ne doit donc pas peser autant dans une moyenne globale.
 */
class StatsCalculatorPondereTest {

	private static final float[][] REFERENCE = {
		{ 10f, 10f },
		{ 20f, 20f },
		{ 30f, 30f },
	};
	private static final double[] LATITUDES = { 0.0, 60.0, -60.0 };

	@Nested
	@DisplayName("Valeurs ponderees exactes")
	class ValeursExactes {

		@Test
		@DisplayName("La moyenne ponderee vaut 17,5 la ou la brute vaut 20")
		void moyenne() {
			StatsResult p = StatsCalculator.calculateStatsWeighted(REFERENCE, LATITUDES);
			assertEquals(17.5, p.mean(), 1e-9);
			assertEquals(20.0, StatsCalculator.calculateStats(REFERENCE).mean(), 1e-9,
					"la moyenne brute sert de temoin : sans ecart, le test ne prouve rien");
		}

		/**
		 * Variance ponderee = somme des w(v - moyenne)^2 divisee par le poids
		 * total, soit (2x1x7,5^2 + 2x0,5x2,5^2 + 2x0,5x12,5^2) / 4 = 275/4,
		 * donc un ecart-type de racine(68,75).
		 */
		@Test
		@DisplayName("L'ecart-type pondere vaut racine(68,75)")
		void ecartType() {
			StatsResult p = StatsCalculator.calculateStatsWeighted(REFERENCE, LATITUDES);
			assertEquals(Math.sqrt(68.75), p.stddev(), 1e-9);
		}

		/**
		 * Mediane ponderee = valeur ou le poids cumule franchit la moitie du
		 * poids total. Trie : 10 (1), 10 (1), 20 (0,5), 20 (0,5), 30 (0,5),
		 * 30 (0,5). La moitie vaut 2, atteinte au second 10.
		 */
		@Test
		@DisplayName("La mediane ponderee est la valeur ou le poids cumule franchit la moitie")
		void medianePonderee() {
			StatsResult p = StatsCalculator.calculateStatsWeighted(REFERENCE, LATITUDES);
			assertEquals(10.0, p.median(), 1e-9);
		}

		/**
		 * Un minimum et un maximum sont des extremes observes, pas des moyennes :
		 * les ponderer n'aurait aucun sens, et afficherait une valeur qui
		 * n'existe nulle part dans la grille.
		 */
		@Test
		@DisplayName("Le min et le max restent les extremes reels, non ponderes")
		void extremesNonPonderes() {
			StatsResult p = StatsCalculator.calculateStatsWeighted(REFERENCE, LATITUDES);
			assertEquals(10.0, p.min(), 1e-9);
			assertEquals(30.0, p.max(), 1e-9);
		}
	}

	@Nested
	@DisplayName("Gardes sur les latitudes")
	class Gardes {

		/**
		 * Le cosinus est negatif au-dela de 90 degres. Sans le plancher a zero,
		 * une latitude aberrante ajouterait un poids NEGATIF : la somme ponderee
		 * et le poids total seraient tous deux fausses, et la moyenne pourrait
		 * sortir de l'intervalle des donnees, voire diverger si le poids total
		 * approchait zero. Le plancher transforme une donnee douteuse en donnee
		 * ignoree, ce qui est le comportement lisible.
		 */
		@Test
		@DisplayName("Une latitude hors bornes recoit un poids nul, jamais negatif")
		void latitudeAberrante() {
			float[][] data = { { 1000f, 1000f }, { 10f, 10f } };
			double[] lats = { 120.0, 0.0 };

			StatsResult p = StatsCalculator.calculateStatsWeighted(data, lats);
			assertEquals(10.0, p.mean(), 1e-9,
					"la rangee a latitude aberrante ne doit pas peser dans la moyenne");
			// Elle reste comptee dans les extremes : la valeur existe bien.
			assertEquals(1000.0, p.max(), 1e-9);
		}

		/**
		 * cos(90) vaut 6e-17 en virgule flottante, pas exactement zero. Un point
		 * chaud polaire pese donc un cent-millieme de milliardieme de cellule
		 * equatoriale : negligeable, ce qui est justement le resultat voulu.
		 */
		@Test
		@DisplayName("Un extreme au pole ne deplace pas la moyenne globale")
		void poleNeDeplacePasLaMoyenne() {
			float[][] data = { { 1000f, 1000f }, { 10f, 10f } };
			double[] lats = { 90.0, 0.0 };

			StatsResult p = StatsCalculator.calculateStatsWeighted(data, lats);
			assertEquals(10.0, p.mean(), 1e-6);
			assertEquals(505.0, StatsCalculator.calculateStats(data).mean(), 1e-9,
					"temoin : sans ponderation le point chaud polaire double la moyenne");
		}

		@Test
		@DisplayName("Toutes les latitudes aberrantes : poids total nul, resultat NaN")
		void poidsTotalNul() {
			float[][] data = { { 1f, 2f }, { 3f, 4f } };
			double[] lats = { 120.0, 150.0 };

			StatsResult p = StatsCalculator.calculateStatsWeighted(data, lats);
			assertTrue(Double.isNaN(p.mean()), "moyenne");
			assertTrue(Double.isNaN(p.stddev()), "ecart-type");
			assertTrue(Double.isNaN(p.median()), "mediane");
		}

		@Test
		@DisplayName("Latitudes absentes ou de longueur incoherente : repli non pondere")
		void repli() {
			double attendu = StatsCalculator.calculateStats(REFERENCE).mean();
			assertEquals(attendu,
					StatsCalculator.calculateStatsWeighted(REFERENCE, null).mean(), 1e-9);
			assertEquals(attendu,
					StatsCalculator.calculateStatsWeighted(REFERENCE, new double[] { 0.0 }).mean(), 1e-9,
					"un tableau de latitudes trop court ne doit pas ponderer au hasard");
		}

		@Test
		@DisplayName("Un tableau vide est refuse, pondere comme non pondere")
		void tableauVide() {
			assertThrows(IllegalArgumentException.class,
					() -> StatsCalculator.calculateStatsWeighted(new float[0][0], LATITUDES));
			assertThrows(IllegalArgumentException.class,
					() -> StatsCalculator.calculateStatsWeighted(null, LATITUDES));
		}
	}

	@Nested
	@DisplayName("Cellules sans valeur")
	class Manquantes {

		/**
		 * Une cellule NaN est une cellule qui n'a pas ete calculee. La compter
		 * comme un zero ferait plonger la moyenne d'un champ ou les valeurs
		 * absentes sont nombreuses (une variable de surface au-dessus du relief,
		 * par exemple).
		 */
		@Test
		@DisplayName("Les NaN sont ecartes du calcul pondere, pas comptes comme zero")
		void nanEcartes() {
			float[][] data = { { 10f, Float.NaN }, { 20f, Float.NaN } };
			double[] lats = { 0.0, 0.0 };

			StatsResult p = StatsCalculator.calculateStatsWeighted(data, lats);
			assertEquals(15.0, p.mean(), 1e-9);
			assertEquals(10.0, p.min(), 1e-9);
			assertEquals(20.0, p.max(), 1e-9);
		}

		@Test
		@DisplayName("Une grille entierement NaN rend NaN et non zero")
		void toutNaN() {
			float[][] data = { { Float.NaN, Float.NaN }, { Float.NaN, Float.NaN } };

			StatsResult brut = StatsCalculator.calculateStats(data);
			assertTrue(Double.isNaN(brut.mean()), "moyenne brute");
			assertTrue(Double.isNaN(brut.min()), "min brut");

			StatsResult pondere = StatsCalculator.calculateStatsWeighted(data, new double[] { 0.0, 0.0 });
			assertTrue(Double.isNaN(pondere.mean()), "moyenne ponderee");
		}
	}

	@Nested
	@DisplayName("Mediane non ponderee")
	class Mediane {

		/**
		 * Sur un nombre pair de valeurs, la mediane s'interpole entre les deux
		 * du milieu. Un test sur un nombre impair passerait meme si le code se
		 * contentait de prendre un element du tableau.
		 */
		@Test
		@DisplayName("Elle s'interpole entre les deux valeurs centrales")
		void interpolation() {
			StatsResult r = StatsCalculator.calculateStats(new float[][] { { 1f, 2f, 3f, 4f } });
			assertEquals(2.5, r.median(), 1e-9);
		}

		@Test
		@DisplayName("Une seule valeur : la mediane est cette valeur")
		void valeurUnique() {
			StatsResult r = StatsCalculator.calculateStats(new float[][] { { 42f } });
			assertEquals(42.0, r.median(), 1e-9);
			assertEquals(42.0, r.min(), 1e-9);
			assertEquals(0.0, r.stddev(), 1e-9);
		}
	}

	@Nested
	@DisplayName("Surcharge liste et difference de grilles")
	class AutresEntrees {

		/**
		 * Une serie temporelle arrive en liste, et un point non calcule y est
		 * un {@code null}. Le convertir en zero creerait un creux qui n'existe
		 * pas dans le modele.
		 */
		@Test
		@DisplayName("Les null d'une liste valent NaN, pas zero")
		void nullsDeLaListe() {
			StatsResult r = StatsCalculator.calculateStats(Arrays.asList(10f, null, 20f, null));
			assertEquals(15.0, r.mean(), 1e-9);
			assertEquals(10.0, r.min(), 1e-9);
			assertEquals(20.0, r.max(), 1e-9);
		}

		@Test
		@DisplayName("Une liste nulle ou vide est refusee")
		void listeInvalide() {
			assertThrows(IllegalArgumentException.class,
					() -> StatsCalculator.calculateStats((List<Float>) null));
			assertThrows(IllegalArgumentException.class,
					() -> StatsCalculator.calculateStats(List.<Float>of()));
		}

		@Test
		@DisplayName("La difference de deux grilles se fait cellule a cellule")
		void difference() {
			float[][] a = { { 10f, 20f }, { 30f, 40f } };
			float[][] b = { { 1f, 2f }, { 3f, 4f } };

			float[][] d = StatsCalculator.computeGridDifference(a, b);
			assertArrayEquals(new float[] { 9f, 18f }, d[0], 1e-6f);
			assertArrayEquals(new float[] { 27f, 36f }, d[1], 1e-6f);
		}

		/**
		 * Deux jeux de donnees peuvent ne pas avoir exactement la meme grille.
		 * On prend l'intersection plutot que de lever : la comparaison reste
		 * possible sur la partie commune, et sortir du tableau le plus petit
		 * leverait une ArrayIndexOutOfBounds au milieu d'une requete.
		 */
		@Test
		@DisplayName("Des grilles de tailles differentes se recoupent sans deborder")
		void differenceTaillesInegales() {
			float[][] a = { { 10f, 20f, 30f }, { 40f, 50f, 60f }, { 70f, 80f, 90f } };
			float[][] b = { { 1f, 2f }, { 3f, 4f } };

			float[][] d = assertDoesNotThrow(() -> StatsCalculator.computeGridDifference(a, b));
			assertEquals(2, d.length, "nombre de rangees");
			assertEquals(2, d[0].length, "nombre de colonnes");
			assertArrayEquals(new float[] { 9f, 18f }, d[0], 1e-6f);
		}

		@Test
		@DisplayName("Une grille sans rangee ne fait pas deborder le calcul")
		void differenceGrilleVide() {
			float[][] d = assertDoesNotThrow(
					() -> StatsCalculator.computeGridDifference(new float[0][], new float[][] { { 1f } }));
			assertEquals(0, d.length);
		}
	}

	/**
	 * La classe est un porte-outils : l'instancier n'aurait aucun sens et
	 * laisserait croire a un etat interne. Le constructeur prive le refuse.
	 */
	@Test
	@DisplayName("La classe utilitaire refuse d'etre instanciee")
	void classeUtilitaire() throws Exception {
		Constructor<StatsCalculator> c = StatsCalculator.class.getDeclaredConstructor();
		c.setAccessible(true);
		InvocationTargetException e = assertThrows(InvocationTargetException.class, c::newInstance);
		assertInstanceOf(UnsupportedOperationException.class, e.getCause());
	}
}
