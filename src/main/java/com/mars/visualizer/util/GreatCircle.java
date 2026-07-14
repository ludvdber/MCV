package com.mars.visualizer.util;

import com.mars.visualizer.exception.ValidationException;

/**
 * Échantillonnage de points le long d'un grand cercle martien.
 *
 * <p>Interpolation sphérique (slerp) entre deux points (lat, lon) en degrés :
 * contrairement à une interpolation linéaire en lat/lon, le trajet suit la
 * géodésique réelle de la sphère, ce qui est la trajectoire physiquement
 * pertinente pour un transect atmosphérique.
 *
 * @author Ludo
 */
public final class GreatCircle {

    private GreatCircle() { }

    /** Angle central minimal (radians) en dessous duquel le transect est dégénéré (~0,06°). */
    private static final double MIN_ANGLE = 1e-3;

    /**
     * Point échantillonné le long du transect.
     *
     * @param lat        latitude en degrés
     * @param lon        longitude en degrés, normalisée dans [-180, 180)
     * @param distanceKm distance cumulée depuis le point de départ, en km
     */
    public record Point(double lat, double lon, double distanceKm) { }

    /**
     * Échantillonne {@code n} points régulièrement espacés le long du grand
     * cercle reliant (lat1, lon1) à (lat2, lon2), bornes incluses.
     *
     * @throws ValidationException si les deux points sont identiques ou
     *         antipodaux (géodésique indéfinie)
     */
    public static Point[] sample(double lat1, double lon1, double lat2, double lon2, int n) {
        double p1 = Math.toRadians(lat1), l1 = Math.toRadians(lon1);
        double p2 = Math.toRadians(lat2), l2 = Math.toRadians(lon2);

        // Coordonnées cartésiennes unitaires
        double x1 = Math.cos(p1) * Math.cos(l1), y1 = Math.cos(p1) * Math.sin(l1), z1 = Math.sin(p1);
        double x2 = Math.cos(p2) * Math.cos(l2), y2 = Math.cos(p2) * Math.sin(l2), z2 = Math.sin(p2);

        // Angle central via atan2 (stable numériquement aux petits et grands angles)
        double dot   = x1 * x2 + y1 * y2 + z1 * z2;
        double cx = y1 * z2 - z1 * y2, cy = z1 * x2 - x1 * z2, cz = x1 * y2 - y1 * x2;
        double cross = Math.sqrt(cx * cx + cy * cy + cz * cz);
        double omega = Math.atan2(cross, dot);

        if (omega < MIN_ANGLE || Math.PI - omega < MIN_ANGLE) {
            throw new ValidationException("error.transect.degenerate");
        }

        double sinOmega = Math.sin(omega);
        Point[] points = new Point[n];
        for (int i = 0; i < n; i++) {
            double f = (double) i / (n - 1);
            double a = Math.sin((1 - f) * omega) / sinOmega;
            double b = Math.sin(f * omega) / sinOmega;
            double x = a * x1 + b * x2, y = a * y1 + b * y2, z = a * z1 + b * z2;
            double lat = Math.toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y)));
            double lon = Math.toDegrees(Math.atan2(y, x));
            points[i] = new Point(lat, lon, f * omega * MarsConstants.MARS_RADIUS_KM);
        }
        return points;
    }
}
