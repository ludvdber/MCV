package com.mars.visualizer.dto.response;

import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Métadonnées descriptives d'un dataset NetCDF de Mars.
 * Contient les informations d'identification et la structure du fichier
 * sans charger les données brutes.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DatasetMetadata {

    /** Id unique du dataset (nom du fichier sans extension). */
    private String id;

    /** Nom complet du fichier NetCDF avec extension nc. */
    private String filename;

    /** Année martienne couverte par le dataset. */
    private Integer marsYear;

    /**
     * Longitude solaire de début (Ls) en degrés [0-360].
     * Définit le début de la période temporelle du dataset.
     */
    private Integer lsStart;

    /**
     * Longitude solaire de fin (Ls) en degrés [0-360].
     * Définit la fin de la période temporelle du dataset.
     */
    private Integer lsEnd;

    /** Liste des noms de variables disponibles dans le dataset (ex: TT, U, V). */
    private List<String> variables;

    /**
     * Dimensions du dataset.
     * Clés attendues : {@code time}, {@code lat}, {@code lon}, {@code altitude}.
     */
    private Map<String, Integer> dimensions;
}
