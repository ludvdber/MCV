package com.mars.visualizer.dto.internal;

import java.util.List;

public record ProfileData(List<Float> values, double[] altitudes, double actualLat, double actualLon) {}
