package com.mars.visualizer.dto.internal;

import java.util.List;

public record AnimationData(List<float[][]> frames, double[] latitudes, double[] longitudes) {}
