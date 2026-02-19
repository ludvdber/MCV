package com.mars.visualizer.dto.response;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Réponse contenant une série temporelle d'une variable atmosphérique
 * en un point géographique et à une altitude donnés.
 * Couvre les 48 pas de temps du dataset (ex: toutes les 30 minutes martiennes).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TimeSeriesResponse {

    /** Id du dataset source. */
    private String dataset;

    /** Nom de la variable extraite (ex: TT). */
    private String variable;

    private Double latitude;
    private Double longitude;
    private Integer altitudeIndex;

    /** Altitude réelle en km (lue depuis la coordonnée NetCDF), null pour les variables de surface. */
    private Double altitudeValue;

    /** Longitude solaire exacte (Ls) du fichier individuel utilisé. Null pour MEAN. */
    private Double actualLs;

    /**
     * Valeurs de la variable aux 48 pas de temps.
     * L'index correspond au pas de temps (0 = début du cycle diurne martien).
     */
    private List<Float> values;

    /** Statistiques descriptives calculées sur la série temporelle. */
    private StatsResult stats;
}
