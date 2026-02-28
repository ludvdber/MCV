package com.mars.visualizer.dto.response;

import java.util.List;

/**
 * Métadonnées d'une année martienne disponible dans les fichiers individuels.
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 */
public record IndividualYearInfo(
    int marsYear,
    double lsMin,
    double lsMax,
    List<String> directories
) {}
