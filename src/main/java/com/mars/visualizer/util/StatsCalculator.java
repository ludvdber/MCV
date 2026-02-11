package com.mars.visualizer.util;

import java.util.Map;

import lombok.extern.slf4j.Slf4j;

/**
 * Classe utilitaire pour le calcul de statistiques descriptives
 * sur des tableaux de données 2D.
 *
 * @author Ludo
 * @version 1.0
 */
@Slf4j
public class StatsCalculator {

    private StatsCalculator() {
        throw new UnsupportedOperationException("Classe utilitaire");
    }

    /**
     * Calcule min, max, mean, stddev d'un tableau 2D.
     * Ignore les valeurs NaN (données manquantes NetCDF).
     *
     * @param data tableau 2D de données
     * @return Map avec {@code min}, {@code max}, {@code mean}, {@code stddev}
     * @throws IllegalArgumentException si data est null ou vide
     */
    public static Map<String, Double> calculateStats(float[][] data) {
        if (data == null || data.length == 0) {
            throw new IllegalArgumentException("Le tableau de données ne peut pas être null ou vide.");
        }

        double min   = Double.MAX_VALUE;
        double max   = -Double.MAX_VALUE;
        double sum   = 0.0;
        long   count = 0;

        // Première passe : min, max, somme
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
            return Map.of("min", Double.NaN, "max", Double.NaN, "mean", Double.NaN, "stddev", Double.NaN);
        }

        double mean = sum / count;

        // Deuxième passe : écart-type
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

        log.debug("Stats calculées : min={}, max={}, mean={}, stddev={} ({} valeurs)", min, max, mean, stddev, count);

        return Map.of("min", min, "max", max, "mean", mean, "stddev", stddev);
    }
}
