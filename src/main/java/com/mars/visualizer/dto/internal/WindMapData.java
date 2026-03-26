package com.mars.visualizer.dto.internal;

public record WindMapData(float[][] windSpeed, double[] latitudes, double[] longitudes,
		double[] subLats, double[] subLons, double[] u, double[] v) {}
