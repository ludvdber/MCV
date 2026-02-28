package com.mars.visualizer.dto.response;

/**
 * Réponse contenant une coupe verticale (méridionale ou zonale).
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 */
public record CrossSectionResponse(
    String dataset,
    String variable,
    Integer timeIndex,
    String type,
    Double fixedCoordinate,
    Double actualLs,
    double[] altitudes,
    double[] horizontalCoords,
    float[][] data,
    StatsResult stats
) {}
