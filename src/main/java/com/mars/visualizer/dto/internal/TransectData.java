package com.mars.visualizer.dto.internal;

/**
 * Données internes d'un transect grand-cercle : coupe verticale
 * {@code data[nAlt][nPoints]} le long d'une géodésique entre deux points.
 *
 * @param data      valeurs [altitude][point du trajet]
 * @param altitudes altitudes en km (nAlt)
 * @param distances distance cumulée en km depuis le départ (nPoints)
 * @param lats      latitudes échantillonnées (nPoints)
 * @param lons      longitudes échantillonnées (nPoints)
 */
public record TransectData(
    float[][] data,
    double[] altitudes,
    double[] distances,
    double[] lats,
    double[] lons
) {}
