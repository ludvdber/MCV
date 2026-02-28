package com.mars.visualizer.dto.response;

import java.util.List;

/**
 * Réponse contenant toutes les frames d'une animation temporelle.
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 */
public record AnimationResponse(
    String dataset,
    String variable,
    Integer altitudeIndex,
    Double altitudeValue,
    Integer frameCount,
    List<float[][]> frames,
    double[] latitudes,
    double[] longitudes,
    StatsResult stats
) {}
