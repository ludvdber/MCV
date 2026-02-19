package com.mars.visualizer.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Réponse contenant une coupe verticale (méridionale ou zonale)
 * d'une variable atmosphérique à un instant donné.
 *
 * Méridionale : data[altitude][latitude] à longitude fixée.
 * Zonale      : data[altitude][longitude] à latitude fixée.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CrossSectionResponse {

    private String dataset;
    private String variable;
    private Integer timeIndex;

    /** Type de coupe : "meridional" ou "zonal". */
    private String type;

    /** Coordonnée fixée (longitude pour méridional, latitude pour zonal). */
    private Double fixedCoordinate;

    /** Longitude solaire exacte (Ls) du fichier individuel utilisé. Null pour MEAN. */
    private Double actualLs;

    /** Altitudes réelles en km (axe Y). */
    private double[] altitudes;

    /** Coordonnées horizontales : latitudes pour méridional, longitudes pour zonal (axe X). */
    private double[] horizontalCoords;

    /** Données 2D [nAlt][nHorizontal]. */
    private float[][] data;

    private StatsResult stats;
}
