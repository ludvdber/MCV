package com.mars.visualizer.util;

import java.util.List;

/**
 * Décomposition harmonique du cycle diurne (marées thermiques atmosphériques).
 *
 * Pour chaque cellule (lat, lon), la série des 48 pas d'heure locale est
 * projetée sur ses deux premiers harmoniques par transformée de Fourier
 * discrète :
 *
 * <pre>
 *   f(t) ≈ moyenne + A₁·cos(2π(t − t₁)/24) + A₂·cos(4π(t − t₂)/12)
 * </pre>
 *
 * - le mode 1 (diurne, période 24 h) suit le forçage solaire direct ;
 * - le mode 2 (semi-diurne, période 12 h) est la signature classique des
 *   marées thermiques martiennes amplifiées par la poussière.
 *
 * L'amplitude Aₙ = √(aₙ² + bₙ²) et la phase est exprimée en HEURE LOCALE DU
 * MAXIMUM (0..24/n), directement lisible par un scientifique, plutôt qu'en
 * radians.
 *
 * @author Ludo
 * @version 1.0
 */
public final class TidesCalculator {

	private TidesCalculator() {
	}

	/**
	 * Résultat de la décomposition : moyenne + amplitude/phase des modes 1 et 2.
	 */
	public record TidesResult(
			float[][] mean,
			float[][] amplitudeDiurnal, float[][] phaseDiurnal,
			float[][] amplitudeSemidiurnal, float[][] phaseSemidiurnal) {
	}

	/**
	 * Calcule les deux premiers harmoniques du cycle diurne, cellule par cellule.
	 *
	 * @param frames les nT pas de temps (typiquement 48), chacun [nLat][nLon]
	 * @return amplitudes et phases des modes diurne et semi-diurne
	 */
	public static TidesResult compute(List<float[][]> frames) {
		int nT = frames.size();
		int nLat = frames.get(0).length;
		int nLon = frames.get(0)[0].length;

		// Tables trigonométriques précalculées (mêmes pour toutes les cellules)
		double[] cos1 = new double[nT], sin1 = new double[nT];
		double[] cos2 = new double[nT], sin2 = new double[nT];
		for (int k = 0; k < nT; k++) {
			double angle = 2.0 * Math.PI * k / nT;
			cos1[k] = Math.cos(angle);
			sin1[k] = Math.sin(angle);
			cos2[k] = Math.cos(2 * angle);
			sin2[k] = Math.sin(2 * angle);
		}

		float[][] mean = new float[nLat][nLon];
		float[][] amp1 = new float[nLat][nLon];
		float[][] pha1 = new float[nLat][nLon];
		float[][] amp2 = new float[nLat][nLon];
		float[][] pha2 = new float[nLat][nLon];

		double hoursPerStep = 24.0 / nT;

		for (int i = 0; i < nLat; i++) {
			for (int j = 0; j < nLon; j++) {
				double sum = 0, a1 = 0, b1 = 0, a2 = 0, b2 = 0;
				boolean valid = true;
				for (int k = 0; k < nT; k++) {
					float v = frames.get(k)[i][j];
					if (Float.isNaN(v)) {
						valid = false;
						break;
					}
					sum += v;
					a1 += v * cos1[k];
					b1 += v * sin1[k];
					a2 += v * cos2[k];
					b2 += v * sin2[k];
				}
				if (!valid) {
					mean[i][j] = Float.NaN;
					amp1[i][j] = Float.NaN;
					pha1[i][j] = Float.NaN;
					amp2[i][j] = Float.NaN;
					pha2[i][j] = Float.NaN;
					continue;
				}
				a1 *= 2.0 / nT;
				b1 *= 2.0 / nT;
				a2 *= 2.0 / nT;
				b2 *= 2.0 / nT;

				mean[i][j] = (float) (sum / nT);
				amp1[i][j] = (float) Math.hypot(a1, b1);
				amp2[i][j] = (float) Math.hypot(a2, b2);

				// Heure locale du maximum : θ_max = atan2(b, a) sur l'axe k,
				// convertie en heures puis repliée sur la période du mode.
				double t1 = Math.atan2(b1, a1) / (2.0 * Math.PI) * nT * hoursPerStep;
				double t2 = Math.atan2(b2, a2) / (2.0 * Math.PI) * (nT / 2.0) * hoursPerStep;
				pha1[i][j] = (float) ((t1 % 24 + 24) % 24);
				pha2[i][j] = (float) ((t2 % 12 + 12) % 12);
			}
		}

		return new TidesResult(mean, amp1, pha1, amp2, pha2);
	}
}
