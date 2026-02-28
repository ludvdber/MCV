package com.mars.visualizer.dto.response;

import java.util.List;

/**
 * Réponse contenant une série temporelle d'une variable atmosphérique.
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 */
public record TimeSeriesResponse(
    String dataset,
    String variable,
    Double latitude,
    Double longitude,
    Integer altitudeIndex,
    Double altitudeValue,
    List<Float> values,
    StatsResult stats
) {}
