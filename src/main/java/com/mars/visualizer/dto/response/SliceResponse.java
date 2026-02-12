package com.mars.visualizer.dto.response;

import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Réponse contenant une coupe 2D (slice) d'une variable atmosphérique.
 * Représente une grille latitude/longitude à un instant et une altitude donnés,
 * prête à être rendue côté client (carte de chaleur, contour, etc.).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SliceResponse {

    /** Identifiant du dataset source. */
    private String dataset;

    /** Nom de la variable extraite (ex: {@code TT}, {@code U}, {@code V}). */
    private String variable;

    /** Index temporel utilisé pour l'extraction (0-47). */
    private Integer timeIndex;

    /** Index d'altitude utilisé pour l'extraction (0-102). */
    private Integer altitudeIndex;

    /** Altitude réelle en km (lue depuis la coordonnée NetCDF), null pour les variables de surface. */
    private Double altitudeValue;

    /**
     * Dimensions de la grille 2D retournée.
     * Clés : {@code lat} (nombre de lignes), {@code lon} (nombre de colonnes).
     */
    private Map<String, Integer> dimensions;

    /**
     * Données brutes de la slice sous forme de grille 2D.
     * Indexation : {@code data[latIndex][lonIndex]}.
     */
    private float[][] data;

    /** Tableau des valeurs de latitude correspondant aux lignes de {@code data}. */
    private double[] latitudes;

    /** Tableau des valeurs de longitude correspondant aux colonnes de {@code data}. */
    private double[] longitudes;

    /** Statistiques descriptives calculées sur les données de la slice. */
    private StatsResult stats;
}
