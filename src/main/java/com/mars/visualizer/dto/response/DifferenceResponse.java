package com.mars.visualizer.dto.response;

public record DifferenceResponse(
    String datasetA,
    String datasetB,
    String variable,
    int timeIndex,
    int altitudeIndex,
    Double altitudeValue,
    float[][] data,
    double[] latitudes,
    double[] longitudes,
    StatsResult stats
) {}
