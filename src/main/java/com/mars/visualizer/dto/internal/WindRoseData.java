package com.mars.visualizer.dto.internal;

import java.util.List;

public record WindRoseData(List<Float> uu, List<Float> vv, double actualLat, double actualLon) {}
