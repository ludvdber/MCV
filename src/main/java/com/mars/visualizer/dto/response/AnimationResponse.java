package com.mars.visualizer.dto.response;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Réponse contenant toutes les frames d'une animation temporelle
 * d'une variable atmosphérique à une altitude donnée.
 * Chaque frame est une slice 2D [lat][lon] correspondant à un pas de temps.
 * Les 48 frames couvrent un cycle diurne martien complet.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AnimationResponse {

    // Id du dataset source.
    private String dataset;

    // Nom de la variable animée (ex: TT).
    private String variable;

    /** Index d'altitude commun à toutes les frames (0-102). */
    private Integer altitudeIndex;

    /**
     * Nombre de frames dans l'animation.
     * Correspond au nombre de pas de temps du dataset (typiquement 48).
     */
    private Integer frameCount;

    /**
     * Liste des 48 frames de l'animation.
     * Chaque élément est une grille 2D {@code float[lat][lon]}.
     * L'index de la liste correspond à l'index temporel.
     */
    private List<float[][]> frames;

    /** Tableau des valeurs de latitude correspondant aux lignes de chaque frame. */
    private double[] latitudes;

    /** Tableau des valeurs de longitude correspondant aux colonnes de chaque frame. */
    private double[] longitudes;

    /** Statistiques descriptives calculées sur l'ensemble des frames. */
    private StatsResult stats;
}
