package com.mars.visualizer.dto.response;

import java.util.List;

public record WindRoseResponse(
    String dataset,
    double latitude,
    double longitude,
    int altitudeIndex,
    Double altitudeValue,
    List<Float> uu,
    List<Float> vv,
    double actualLat,
    double actualLon
) {}
