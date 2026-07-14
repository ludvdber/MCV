package com.mars.visualizer.dto.response;

/**
 * Réponse de l'endpoint des marées thermiques (décomposition harmonique du
 * cycle diurne, modes 1 et 2).
 *
 * Les phases sont exprimées en heure locale du maximum : 0..24 h pour le mode
 * diurne, 0..12 h pour le mode semi-diurne.
 *
 * @author Ludo
 * @version 1.0
 */
public record TidesResponse(
		String dataset,
		String variable,
		int altitudeIndex,
		Double altitudeValue,
		double[] latitudes,
		double[] longitudes,
		float[][] mean,
		float[][] amplitudeDiurnal,
		float[][] phaseDiurnal,
		float[][] amplitudeSemidiurnal,
		float[][] phaseSemidiurnal,
		StatsResult statsDiurnal,
		StatsResult statsSemidiurnal) {
}
