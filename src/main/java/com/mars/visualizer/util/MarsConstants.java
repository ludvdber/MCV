package com.mars.visualizer.util;

/**
 * Constantes partagees entre les controllers et services.
 * Les constantes specifiques a un seul service (COORD_LAT, VAR_UU, etc.)
 * restent dans leur service respectif.
 *
 * @author Ludo
 */
public final class MarsConstants {

    private MarsConstants() { }

    /** Type de coupe verticale meridionale (longitude fixee). */
    public static final String CROSS_SECTION_MERIDIONAL = "meridional";

    /** Type de coupe verticale zonale (latitude fixee). */
    public static final String CROSS_SECTION_ZONAL = "zonal";

    /** Periode standard d'une plage Ls dans les datasets MEAN (degres). */
    public static final int LS_PERIOD = 30;

    /** Valeur maximale de Ls (degres) avant retour a 0. */
    public static final int LS_MAX = 360;

    /** Type de Hovmoller par latitude. */
    public static final String HOVMOLLER_LATITUDE = "latitude";

    /** Type de Hovmoller par longitude. */
    public static final String HOVMOLLER_LONGITUDE = "longitude";

    /**
     * Genere un tableau de temps en heures martiennes (0h..~24h)
     * pour un nombre de pas de temps donne (typiquement 48).
     */
    public static double[] generateTimeHours(int nTime) {
        double[] times = new double[nTime];
        for (int t = 0; t < nTime; t++) {
            times[t] = (t * 24.0) / nTime;
        }
        return times;
    }
}
