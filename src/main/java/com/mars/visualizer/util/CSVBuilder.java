package com.mars.visualizer.util;

import java.util.List;

/**
 * Utilitaire pour la construction de fichiers CSV.
 * Factorise les patterns récurrents d'export de données grille et séries.
 */
public final class CSVBuilder {

	private CSVBuilder() {}

	/**
	 * Construit un CSV pour une grille 2D (latitude × longitude × valeur).
	 * Utilisé par slice, windmap, et comme base pour crosssection/hovmoller/zonalmean.
	 */
	public static String grid2D(float[][] data, double[] rowCoords, double[] colCoords,
			String rowLabel, String colLabel, String valueLabel) {
		StringBuilder sb = new StringBuilder(data.length * data[0].length * 20);
		sb.append(rowLabel).append(',').append(colLabel).append(',').append(valueLabel).append('\n');
		for (int i = 0; i < data.length; i++) {
			double row = coordAt(rowCoords, i);
			for (int j = 0; j < data[i].length; j++) {
				double col = coordAt(colCoords, j);
				sb.append(row).append(',').append(col).append(',').append(data[i][j]).append('\n');
			}
		}
		return sb.toString();
	}

	/**
	 * Construit un CSV pour une grille 2D avec colonnes supplémentaires (différence A-B).
	 */
	public static String differenceGrid(float[][] dataA, float[][] dataB,
			double[] latitudes, double[] longitudes) {
		if (dataA.length != dataB.length || (dataA.length > 0 && dataA[0].length != dataB[0].length)) {
			throw new IllegalArgumentException("Grid dimensions mismatch: A[" + dataA.length + "] vs B[" + dataB.length + "]");
		}
		StringBuilder sb = new StringBuilder(dataA.length * (dataA.length > 0 ? dataA[0].length : 0) * 30);
		sb.append("latitude,longitude,value_A,value_B,difference\n");
		for (int i = 0; i < dataA.length; i++) {
			double lat = coordAt(latitudes, i);
			for (int j = 0; j < dataA[i].length; j++) {
				double lon = coordAt(longitudes, j);
				float a = dataA[i][j];
				float b = dataB[i][j];
				sb.append(lat).append(',').append(lon).append(',')
				  .append(a).append(',').append(b).append(',').append(a - b).append('\n');
			}
		}
		return sb.toString();
	}

	/**
	 * Construit un CSV pour une série 1D indexée (timestep, value).
	 */
	public static String series(List<Float> values, String indexLabel, String valueLabel) {
		StringBuilder sb = new StringBuilder(values.size() * 15);
		sb.append(indexLabel).append(',').append(valueLabel).append('\n');
		for (int i = 0; i < values.size(); i++) {
			sb.append(i).append(',').append(values.get(i)).append('\n');
		}
		return sb.toString();
	}

	/**
	 * Construit un CSV pour deux séries parallèles (timestep, uu, vv).
	 */
	public static String pairedSeries(List<Float> seriesA, List<Float> seriesB,
			String indexLabel, String labelA, String labelB) {
		int n = Math.min(seriesA.size(), seriesB.size());
		StringBuilder sb = new StringBuilder(n * 20);
		sb.append(indexLabel).append(',').append(labelA).append(',').append(labelB).append('\n');
		for (int i = 0; i < n; i++) {
			sb.append(i).append(',').append(seriesA.get(i)).append(',').append(seriesB.get(i)).append('\n');
		}
		return sb.toString();
	}

	/**
	 * Construit un CSV pour un profil vertical (altitude, value).
	 */
	public static String profile(List<Float> values, double[] altitudes) {
		StringBuilder sb = new StringBuilder(values.size() * 15);
		sb.append("altitude_km,value\n");
		for (int i = 0; i < values.size(); i++) {
			double alt = coordAt(altitudes, i);
			sb.append(alt).append(',').append(values.get(i)).append('\n');
		}
		return sb.toString();
	}

	/**
	 * Construit un CSV pour un profil temporel (altitude × temps).
	 */
	public static String temporalProfile(float[][] data, double[] altitudes, int nTime) {
		StringBuilder sb = new StringBuilder(data.length * nTime * 12);
		sb.append("altitude_km");
		for (int t = 0; t < nTime; t++) {
			sb.append(',').append(String.format("t%.1fh", (t * 24.0) / nTime));
		}
		sb.append('\n');
		for (int a = 0; a < altitudes.length; a++) {
			sb.append(altitudes[a]);
			for (int t = 0; t < nTime; t++) {
				sb.append(',').append(data[a][t]);
			}
			sb.append('\n');
		}
		return sb.toString();
	}

	private static double coordAt(double[] coords, int index) {
		if (coords == null || index >= coords.length) {
			throw new IllegalArgumentException("Missing coordinate at index " + index);
		}
		return coords[index];
	}
}
