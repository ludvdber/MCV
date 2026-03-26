package com.mars.visualizer.dto.response;

/**
 * Réponse contenant un diagramme de Hovmöller (temps × lat ou lon).
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 */
public record HovmollerResponse(
    String dataset,
    String variable,
    Integer altitudeIndex,
    Double altitudeValue,
    String type,
    double[] times,
    double[] spatialCoords,
    float[][] data,
    StatsResult stats
) {}
