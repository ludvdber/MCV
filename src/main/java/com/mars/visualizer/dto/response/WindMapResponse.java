package com.mars.visualizer.dto.response;

public record WindMapResponse(
    String dataset,
    int timeIndex,
    int altitudeIndex,
    Double altitudeValue,
    Double actualLs,
    float[][] windSpeed,
    double[] latitudes,
    double[] longitudes,
    double[] subLats,
    double[] subLons,
    double[] u,
    double[] v,
    StatsResult stats
) {}
