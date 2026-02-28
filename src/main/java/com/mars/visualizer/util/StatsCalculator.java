package com.mars.visualizer.util;

import java.util.List;

import com.mars.visualizer.dto.response.StatsResult;

import lombok.extern.slf4j.Slf4j;

/**
 * Classe utilitaire pour le calcul de statistiques descriptives.
 * Retourne directement un {@link StatsResult} record (Java 21).
 *
 * @author Ludo
 * @version 2.0
 */
@Slf4j
public class StatsCalculator {

    private StatsCalculator() {
        throw new UnsupportedOperationException("Classe utilitaire");
    }

    /**
     * Calcule min, max, mean, stddev d'un tableau 2D.
     * Ignore les valeurs NaN (données manquantes NetCDF).
     * Algorithme en deux passes (numériquement stable pour l'écart-type).
     *
     * @param data tableau 2D de données
     * @return StatsResult immuable
     * @throws IllegalArgumentException si data est null ou vide
     */
    public static StatsResult calculateStats(float[][] data) {
        if (data == null || data.length == 0) {
            throw new IllegalArgumentException("Le tableau de données ne peut pas être null ou vide.");
        }

        double min   = Double.MAX_VALUE;
        double max   = -Double.MAX_VALUE;
        double sum   = 0.0;
        long   count = 0;

        for (float[] row : data) {
            for (float value : row) {
                if (!Float.isNaN(value)) {
                    if (value < min) min = value;
                    if (value > max) max = value;
                    sum += value;
                    count++;
                }
            }
        }

        if (count == 0) {
            log.warn("Aucune valeur valide dans le tableau (tout NaN)");
            return new StatsResult(Double.NaN, Double.NaN, Double.NaN, Double.NaN);
        }

        double mean = sum / count;

        double varianceSum = 0.0;
        for (float[] row : data) {
            for (float value : row) {
                if (!Float.isNaN(value)) {
                    double diff = value - mean;
                    varianceSum += diff * diff;
                }
            }
        }
        double stddev = Math.sqrt(varianceSum / count);

        log.debug("Stats calculées : min={}, max={}, mean={}, stddev={} ({} valeurs)",
                min, max, mean, stddev, count);

        return new StatsResult(min, max, mean, stddev);
    }

    /**
     * Surcharge pour une liste de valeurs (série temporelle, profil vertical).
     * Convertit en matrice 1×N puis délègue à {@link #calculateStats(float[][])}.
     *
     * @param values liste de valeurs (null traités comme NaN)
     * @return StatsResult immuable
     */
    public static StatsResult calculateStats(List<Float> values) {
        if (values == null || values.isEmpty()) {
            throw new IllegalArgumentException("La liste de valeurs ne peut pas être null ou vide.");
        }
        float[][] matrix = new float[1][values.size()];
        for (int i = 0; i < values.size(); i++) {
            Float v = values.get(i);
            matrix[0][i] = (v != null) ? v : Float.NaN;
        }
        return calculateStats(matrix);
    }
}
