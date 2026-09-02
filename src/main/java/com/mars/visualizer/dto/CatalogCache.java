package com.mars.visualizer.dto;

import com.mars.visualizer.dto.response.IndividualYearInfo;

import java.util.List;

/**
 * DTO de sérialisation JSON pour le cache du catalogue INDIVIDUAL.
 * Record Java 21 — sérialisé/désérialisé nativement par Jackson 3.
 *
 * <p>{@code signature} est l'empreinte du contenu du dossier {@code individual/}
 * au moment du scan (nom et date de modification de chaque sous-répertoire).
 * Le cache n'est réutilisé que si l'empreinte recalculée au démarrage lui est
 * identique. Voir {@code IndividualCatalogService#computeSignature}.
 */
public record CatalogCache(
    String signature,
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
