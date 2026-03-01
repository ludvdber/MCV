package com.mars.visualizer.controller;

import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

/**
 * Classe de base pour les controllers manipulant des datasets NetCDF.
 * Centralise la logique de résolution de dataset et la construction
 * du label affiché, partagées entre FileController et ExportController.
 *
 * @author Ludo
 * @version 1.0
 */
public abstract class AbstractDataController {

    protected final ValidationService validationService;
    protected final DatasetResolver   datasetResolver;

    protected AbstractDataController(ValidationService validationService,
                                     DatasetResolver datasetResolver) {
        this.validationService = validationService;
        this.datasetResolver   = datasetResolver;
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
