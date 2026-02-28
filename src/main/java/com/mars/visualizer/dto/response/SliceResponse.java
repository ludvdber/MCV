package com.mars.visualizer.dto.response;

import java.util.Map;

/**
 * Réponse contenant une coupe 2D (slice) d'une variable atmosphérique.
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 */
public record SliceResponse(
    String dataset,
    String variable,
    Integer timeIndex,
    Integer altitudeIndex,
    Double altitudeValue,
    Double actualLs,
    Map<String, Integer> dimensions,
    float[][] data,
    double[] latitudes,
    double[] longitudes,
    StatsResult stats
) {}
