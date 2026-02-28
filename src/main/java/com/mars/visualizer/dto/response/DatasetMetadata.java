package com.mars.visualizer.dto.response;

import java.util.List;
import java.util.Map;

/**
 * Métadonnées descriptives d'un dataset NetCDF de Mars.
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 */
public record DatasetMetadata(
    String id,
    String filename,
    Integer marsYear,
    Integer lsStart,
    Integer lsEnd,
    List<String> variables,
    Map<String, Integer> dimensions
) {}
