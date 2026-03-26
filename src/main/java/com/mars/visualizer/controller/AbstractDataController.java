package com.mars.visualizer.controller;

import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;

import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

/**
 * Classe de base pour les controllers manipulant des datasets NetCDF.
 * Centralise la logique de résolution de dataset, la construction
 * du label affiché et le cache HTTP, partagées entre tous les controllers.
 *
 * @author Ludo
 * @version 2.0
 */
public abstract class AbstractDataController {

    /** Cache 30 jours pour les données statiques NetCDF. */
    protected static final CacheControl DATA_CACHE = CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic();

    /** Cache 1 heure pour les métadonnées (catalogues). */
    protected static final CacheControl META_CACHE = CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic();

    protected final ValidationService validationService;
    protected final DatasetResolver   datasetResolver;

    protected AbstractDataController(ValidationService validationService,
                                     DatasetResolver datasetResolver) {
        this.validationService = validationService;
        this.datasetResolver   = datasetResolver;
    }

    /** Retourne une réponse cachée 30 jours. */
    protected <T> ResponseEntity<T> cachedOk(T body) {
        return ResponseEntity.ok().cacheControl(DATA_CACHE).body(body);
    }

    /** Retourne une réponse cachée 1 heure (métadonnées). */
    protected <T> ResponseEntity<T> metaOk(T body) {
        return ResponseEntity.ok().cacheControl(META_CACHE).body(body);
    }

    /**
     * Résout le nom de fichier NetCDF pour un dataset donné,
     * et ajuste le time index à 0 pour les datasets INDIVIDUAL.
     *
     * @param dataset identifiant du dataset (MEAN ou IND_MYxx_LSyy)
     * @param time    index temporel demandé
     * @return tableau {filename, adjustedTime}
     */
    protected ResolvedDataset resolveDataset(String dataset, int time) {
        String filename = datasetResolver.resolveFilename(dataset);
        int adjustedTime = datasetResolver.isIndividualDataset(dataset) ? 0 : time;
        return new ResolvedDataset(filename, adjustedTime);
    }

    /**
     * Construit un label lisible pour le dataset (ex: "MY34 Ls 5.50" pour IND,
     * ou le nom du dataset MEAN tel quel).
     */
    protected String buildDatasetLabel(String dataset) {
        if (datasetResolver.isIndividualDataset(dataset)) {
            return dataset.replace(DatasetResolver.INDIVIDUAL_PREFIX, "").replace("_", " ");
        }
        return dataset;
    }

    /**
     * Résultat de la résolution d'un dataset.
     */
    protected record ResolvedDataset(String filename, int time) {}
}
