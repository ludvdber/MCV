package com.mars.visualizer.dto.response;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Réponse contenant un profil vertical d'une variable atmosphérique
 * en un point géographique et à un instant donné.
 * Chaque valeur correspond à un niveau d'altitude (0 = sommet, max = surface).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ProfileResponse {

    private String dataset;
    private String variable;
    private Integer timeIndex;
    private Double latitude;
    private Double longitude;

    /** Longitude solaire exacte (Ls) du fichier individuel utilisé. Null pour MEAN. */
    private Double actualLs;

    /** Altitudes réelles en km pour chaque niveau vertical. */
    private double[] altitudes;

    /** Valeurs de la variable à chaque niveau d'altitude. */
    private List<Float> values;

    private StatsResult stats;
}
