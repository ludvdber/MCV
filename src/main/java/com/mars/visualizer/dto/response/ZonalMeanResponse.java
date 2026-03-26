package com.mars.visualizer.dto.response;

/**
 * Réponse contenant une moyenne zonale (lat × altitude).
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 */
public record ZonalMeanResponse(
    String dataset,
    String variable,
    Integer timeIndex,
    Double actualLs,
    double[] latitudes,
    double[] altitudes,
    float[][] data,
    StatsResult stats
) {}
