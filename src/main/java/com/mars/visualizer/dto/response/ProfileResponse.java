package com.mars.visualizer.dto.response;

import java.util.List;

/**
 * Réponse contenant un profil vertical d'une variable atmosphérique.
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 */
public record ProfileResponse(
    String dataset,
    String variable,
    Integer timeIndex,
    Double latitude,
    Double longitude,
    Double actualLs,
    double[] altitudes,
    List<Float> values,
    StatsResult stats
) {}
