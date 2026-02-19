package com.mars.visualizer.dto;

import com.mars.visualizer.dto.response.IndividualYearInfo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO de sérialisation JSON pour le cache du catalogue INDIVIDUAL.
 * Stocké dans {individual_path}/.catalog-cache.json afin d'éviter
 * un scan complet du filesystem à chaque démarrage.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CatalogCache {

    /** Horodatage lastModified du dossier individual/ lors du dernier scan. */
    private long dirLastModified;

    /** Années martiennes avec bornes Ls. */
    private List<IndividualYearInfo> yearInfos;

    /** Métadonnées par sous-répertoire (chemin sérialisé en String). */
    private List<CachedDirInfo> dirInfos;

    /**
     * Version sérialisable de {@code IndividualCatalogService.DirInfo}.
     * {@code Path} remplacé par {@code String} pour la compatibilité JSON.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CachedDirInfo {
        private String dirName;
        private String dirPath;   // chemin absolu sérialisé en String
        private double lsMin;
        private double lsMax;
        private int    marsYear;
    }
}
