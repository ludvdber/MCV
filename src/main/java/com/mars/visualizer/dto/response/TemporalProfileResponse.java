package com.mars.visualizer.dto.response;

/**
 * Réponse contenant un profil temporel (heatmap altitude × temps) en un point lat/lon.
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 *
 * <p>{@code data} est indexé {@code [nAlt][nTime]} — altitude sur l'axe Y, temps sur l'axe X.
 */
public record TemporalProfileResponse(
    String dataset,
    String variable,
    double latitude,
    double longitude,
    Double actualLs,
    double[] altitudes,
    double[] times,
    float[][] data,
    StatsResult stats
) {}
