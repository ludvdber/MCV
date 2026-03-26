package com.mars.visualizer.dto.response;

public record HealthCheckResponse(String status, String service, String version) {}
