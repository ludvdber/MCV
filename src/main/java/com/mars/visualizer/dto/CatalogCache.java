package com.mars.visualizer.dto;

import com.mars.visualizer.dto.response.IndividualYearInfo;

import java.util.List;

/**
 * DTO de sérialisation JSON pour le cache du catalogue INDIVIDUAL.
 * Record Java 21 — sérialisé/désérialisé nativement par Jackson 3.
 */
public record CatalogCache(
    long dirLastModified,
    List<IndividualYearInfo> yearInfos,
    List<CachedDirInfo> dirInfos
) {
    /**
     * Version sérialisable de {@code IndividualCatalogService.DirInfo}.
     * {@code Path} remplacé par {@code String} pour la compatibilité JSON.
     */
    public record CachedDirInfo(
        String dirName,
        String dirPath,
        double lsMin,
        double lsMax,
        int marsYear
    ) {}
}
