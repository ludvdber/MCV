package com.mars.visualizer.dto.response;

/**
 * Réponse contenant un transect grand-cercle : coupe verticale le long de la
 * géodésique reliant deux points (lat, lon).
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 */
public record TransectResponse(
    String dataset,
    String variable,
    Integer timeIndex,
    Double actualLs,
    double lat1,
    double lon1,
    double lat2,
    double lon2,
    double[] altitudes,
    double[] distances,
    double[] lats,
    double[] lons,
    float[][] data,
    StatsResult stats
) {}
