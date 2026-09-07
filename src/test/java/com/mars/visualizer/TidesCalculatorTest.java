package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.mars.visualizer.util.TidesCalculator;
import com.mars.visualizer.util.TidesCalculator.TidesResult;

/**
 * Décomposition harmonique du cycle diurne, vérifiée contre des signaux dont la
 * réponse est connue analytiquement.
 *
 * <p>La classe n'avait aucun test (0 % de couverture) alors qu'elle produit un
 * résultat scientifique publié : amplitude et phase des marées thermiques. Un
 * test de couverture ne suffirait pas ici. On injecte donc des cosinus
 * d'amplitude et de phase choisies, et on exige de les retrouver : c'est la
 * seule façon de prouver la convention de phase, qui est l'endroit où ce genre
 * de code se trompe silencieusement (un facteur 2 ou un signe ne se voit pas
 * sur une carte, il la décale).
 *
 * <p>Convention attendue, telle que documentée par la classe : la phase est
 * l'HEURE LOCALE DU MAXIMUM, dans [0,24[ pour le mode diurne et [0,12[ pour le
 * mode semi-diurne.
 */
class TidesCalculatorTest {

	private static final int N = 48;              // 48 pas d'heure locale
	private static final double PAS = 24.0 / N;   // 0,5 h

	/** Ecart entre deux heures sur un cadran de {@code periode} heures. */
	private static double ecartCyclique(double a, double b, double periode) {
		double d = Math.abs(a - b) % periode;
		return Math.min(d, periode - d);
	}

	/**
	 * Construit une grille 1x1 dont la série temporelle vaut
	 * {@code moyenne + a1·cos(2π(t−t1)/24) + a2·cos(2π(t−t2)/12)}.
	 */
	private static List<float[][]> signal(double moyenne, double a1, double t1, double a2, double t2) {
		List<float[][]> frames = new ArrayList<>(N);
		for (int k = 0; k < N; k++) {
			double t = k * PAS;
			double v = moyenne
					+ a1 * Math.cos(2 * Math.PI * (t - t1) / 24.0)
					+ a2 * Math.cos(2 * Math.PI * (t - t2) / 12.0);
			frames.add(new float[][]{{(float) v}});
		}
		return frames;
	}

	@Nested
	@DisplayName("Mode diurne (24 h)")
	class Diurne {

		@Test
		@DisplayName("Retrouve l'amplitude et l'heure du maximum injectées")
		void retrouveAmplitudeEtPhase() {
			TidesResult r = TidesCalculator.compute(signal(210.0, 12.0, 15.0, 0.0, 0.0));

			assertThat(r.mean()[0][0]).isCloseTo(210.0f, within(1e-3f));
			assertThat(r.amplitudeDiurnal()[0][0]).isCloseTo(12.0f, within(1e-3f));
			assertThat(r.phaseDiurnal()[0][0])
					.as("La phase doit etre l'heure locale du maximum, soit 15 h")
					.isCloseTo(15.0f, within(1e-3f));
		}

		@Test
		@DisplayName("La phase suit le maximum réel du signal échantillonné")
		void phaseCoincideAvecLeMaximum() {
			// Verification independante de la formule : on cherche le pas ou le
			// signal est maximal et on le compare a la phase rendue.
			for (double t1 : new double[]{0.0, 3.5, 9.0, 14.5, 21.0}) {
				List<float[][]> frames = signal(200.0, 8.0, t1, 0.0, 0.0);
				int kMax = 0;
				for (int k = 1; k < N; k++) {
					if (frames.get(k)[0][0] > frames.get(kMax)[0][0]) kMax = k;
				}
				float phase = TidesCalculator.compute(frames).phaseDiurnal()[0][0];
				// L'heure est CYCLIQUE : 23,9 h et 0,1 h sont voisines. Comparer les
				// nombres directement ferait echouer le cas du maximum a minuit.
				assertThat(ecartCyclique(phase, kMax * PAS, 24.0))
						.as("t1=%.1f : maximum echantillonne a %.1f h, phase rendue %.2f h", t1, kMax * PAS, phase)
						.isLessThanOrEqualTo(0.51); // tolerance = un demi-pas
			}
		}

		@Test
		@DisplayName("La phase reste strictement dans [0,24[, minuit compris")
		void phaseJamaisEgaleALaPeriode() {
			// Cas trouve par ce test : pour un maximum a minuit, atan2 rend un
			// epsilon negatif, le repli donne 24 - 1e-15, et le passage en float
			// arrondissait a 24,0 pile. La cellule affichait 24 h la ou sa voisine
			// affichait 0 h pour le meme instant.
			for (double t1 : new double[]{0.0, 24.0, 48.0, -24.0, 23.999}) {
				float phase = TidesCalculator.compute(signal(200.0, 7.0, t1, 0.0, 0.0)).phaseDiurnal()[0][0];
				assertThat(phase)
						.as("t1=%.3f", t1)
						.isGreaterThanOrEqualTo(0.0f)
						.isLessThan(24.0f);
			}
		}

		@Test
		@DisplayName("Une heure de maximum hors de [0,24[ est repliée dans l'intervalle")
		void phaseRepliee() {
			// 27 h est le meme instant que 3 h.
			TidesResult r = TidesCalculator.compute(signal(180.0, 5.0, 27.0, 0.0, 0.0));
			assertThat(r.phaseDiurnal()[0][0]).isCloseTo(3.0f, within(1e-3f));
			assertThat(r.phaseDiurnal()[0][0]).isBetween(0.0f, 24.0f);
		}
	}

	@Nested
	@DisplayName("Mode semi-diurne (12 h)")
	class SemiDiurne {

		@Test
		@DisplayName("Retrouve l'amplitude et l'heure du maximum injectées")
		void retrouveAmplitudeEtPhase() {
			TidesResult r = TidesCalculator.compute(signal(150.0, 0.0, 0.0, 4.0, 5.0));

			assertThat(r.amplitudeSemidiurnal()[0][0]).isCloseTo(4.0f, within(1e-3f));
			assertThat(r.phaseSemidiurnal()[0][0])
					.as("Phase du mode 12 h, exprimee dans [0,12[")
					.isCloseTo(5.0f, within(1e-3f));
		}

		@Test
		@DisplayName("La phase du mode 12 h reste dans [0,12[")
		void phaseDansSaPeriode() {
			// 5 h et 17 h decrivent le meme maximum pour une onde de periode 12 h.
			TidesResult r = TidesCalculator.compute(signal(150.0, 0.0, 0.0, 4.0, 17.0));
			assertThat(r.phaseSemidiurnal()[0][0]).isCloseTo(5.0f, within(1e-3f));
			assertThat(r.phaseSemidiurnal()[0][0]).isBetween(0.0f, 12.0f);
		}

		@Test
		@DisplayName("La phase reste strictement dans [0,12[, midi et minuit compris")
		void phaseJamaisEgaleALaPeriode() {
			for (double t2 : new double[]{0.0, 12.0, 24.0, -12.0, 11.999}) {
				float phase = TidesCalculator.compute(signal(150.0, 0.0, 0.0, 3.0, t2)).phaseSemidiurnal()[0][0];
				assertThat(phase).as("t2=%.3f", t2).isGreaterThanOrEqualTo(0.0f).isLessThan(12.0f);
			}
		}
	}

	@Nested
	@DisplayName("Les deux modes ensemble")
	class DeuxModes {

		@Test
		@DisplayName("Les modes ne se contaminent pas")
		void modesIndependants() {
			// C'est le vrai piege d'une decomposition harmonique : si le facteur
			// 2/N ou l'indice du second harmonique est faux, l'energie d'un mode
			// fuit dans l'autre sans que rien ne le signale.
			TidesResult r = TidesCalculator.compute(signal(220.0, 10.0, 16.0, 3.0, 2.0));

			assertThat(r.mean()[0][0]).isCloseTo(220.0f, within(1e-3f));
			assertThat(r.amplitudeDiurnal()[0][0]).isCloseTo(10.0f, within(1e-3f));
			assertThat(r.phaseDiurnal()[0][0]).isCloseTo(16.0f, within(1e-3f));
			assertThat(r.amplitudeSemidiurnal()[0][0]).isCloseTo(3.0f, within(1e-3f));
			assertThat(r.phaseSemidiurnal()[0][0]).isCloseTo(2.0f, within(1e-3f));
		}

		@Test
		@DisplayName("Un champ constant n'a aucune marée")
		void champConstant() {
			TidesResult r = TidesCalculator.compute(signal(195.0, 0.0, 0.0, 0.0, 0.0));

			assertThat(r.mean()[0][0]).isCloseTo(195.0f, within(1e-3f));
			assertThat(r.amplitudeDiurnal()[0][0]).isCloseTo(0.0f, within(1e-4f));
			assertThat(r.amplitudeSemidiurnal()[0][0]).isCloseTo(0.0f, within(1e-4f));
		}
	}

	@Nested
	@DisplayName("Cellules masquées et géométrie")
	class CellulesEtGeometrie {

		@Test
		@DisplayName("Un seul NaN dans la série masque toute la cellule")
		void unNaNMasqueLaCellule() {
			// Choix assume : une serie incomplete ne donne pas une harmonique
			// « presque juste », elle ne donne rien.
			List<float[][]> frames = signal(200.0, 6.0, 12.0, 0.0, 0.0);
			frames.get(20)[0][0] = Float.NaN;

			TidesResult r = TidesCalculator.compute(frames);
			assertThat(r.mean()[0][0]).isNaN();
			assertThat(r.amplitudeDiurnal()[0][0]).isNaN();
			assertThat(r.phaseDiurnal()[0][0]).isNaN();
			assertThat(r.amplitudeSemidiurnal()[0][0]).isNaN();
			assertThat(r.phaseSemidiurnal()[0][0]).isNaN();
		}

		@Test
		@DisplayName("Une cellule masquée n'affecte pas ses voisines")
		void masquageLocal() {
			List<float[][]> frames = new ArrayList<>();
			List<float[][]> ref = signal(200.0, 6.0, 12.0, 0.0, 0.0);
			for (int k = 0; k < N; k++) {
				float v = ref.get(k)[0][0];
				frames.add(new float[][]{{v, v}, {v, v}});
			}
			frames.get(10)[1][0] = Float.NaN;

			TidesResult r = TidesCalculator.compute(frames);
			assertThat(r.amplitudeDiurnal()[1][0]).isNaN();
			assertThat(r.amplitudeDiurnal()[0][0]).isCloseTo(6.0f, within(1e-3f));
			assertThat(r.amplitudeDiurnal()[0][1]).isCloseTo(6.0f, within(1e-3f));
			assertThat(r.amplitudeDiurnal()[1][1]).isCloseTo(6.0f, within(1e-3f));
		}

		@Test
		@DisplayName("Les grilles rendues gardent la forme des images d'entrée")
		void formeConservee() {
			List<float[][]> frames = new ArrayList<>();
			for (int k = 0; k < N; k++) frames.add(new float[5][7]);

			TidesResult r = TidesCalculator.compute(frames);
			for (float[][] grille : List.of(r.mean(), r.amplitudeDiurnal(), r.phaseDiurnal(),
					r.amplitudeSemidiurnal(), r.phaseSemidiurnal())) {
				assertThat(grille).hasDimensions(5, 7);
			}
		}
	}
}
