package com.mars.visualizer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.util.GreatCircle;
import com.mars.visualizer.util.MarsConstants;

/**
 * Tests unitaires de l'échantillonnage grand-cercle (transect).
 */
class GreatCircleTest {

    @Test
    @DisplayName("Quart d'équateur : point médian et distance corrects")
    void quartEquateur() {
        GreatCircle.Point[] pts = GreatCircle.sample(0, 0, 0, 90, 91);

        assertEquals(91, pts.length);
        // Bornes incluses
        assertEquals(0.0, pts[0].lat(), 1e-9);
        assertEquals(0.0, pts[0].lon(), 1e-9);
        assertEquals(0.0, pts[90].lat(), 1e-6);
        assertEquals(90.0, pts[90].lon(), 1e-6);
        // Le long de l'équateur, la longitude progresse linéairement
        assertEquals(45.0, pts[45].lon(), 1e-6);
        assertEquals(0.0, pts[45].lat(), 1e-6);
        // Distance totale = R * pi/2
        assertEquals(MarsConstants.MARS_RADIUS_KM * Math.PI / 2, pts[90].distanceKm(), 0.01);
        assertEquals(0.0, pts[0].distanceKm(), 1e-9);
    }

    @Test
    @DisplayName("Trajet méridien : latitude monotone, longitude constante")
    void trajetMeridien() {
        GreatCircle.Point[] pts = GreatCircle.sample(-60, 30, 60, 30, 25);

        for (int i = 1; i < pts.length; i++) {
            assertTrue(pts[i].lat() > pts[i - 1].lat(), "latitude croissante");
            assertEquals(30.0, pts[i].lon(), 1e-6);
            assertTrue(pts[i].distanceKm() > pts[i - 1].distanceKm(), "distance croissante");
        }
    }

    @Test
    @DisplayName("Trajet oblique : les extrémités sont exactes")
    void trajetOblique() {
        GreatCircle.Point[] pts = GreatCircle.sample(-18.65, -133.8, 42.5, 70.9, 96);

        assertEquals(-18.65, pts[0].lat(), 1e-6);
        assertEquals(-133.8, pts[0].lon(), 1e-6);
        assertEquals(42.5, pts[95].lat(), 1e-6);
        assertEquals(70.9, pts[95].lon(), 1e-6);
    }

    @Test
    @DisplayName("Points identiques : ValidationException")
    void pointsIdentiques() {
        assertThrows(ValidationException.class,
                () -> GreatCircle.sample(10, 20, 10, 20, 16));
    }

    @Test
    @DisplayName("Points antipodaux : ValidationException (géodésique indéfinie)")
    void pointsAntipodaux() {
        assertThrows(ValidationException.class,
                () -> GreatCircle.sample(0, 0, 0, 180, 16));
    }

    @Test
    @DisplayName("Les longitudes restent normalisées dans [-180, 180]")
    void longitudesNormalisees() {
        // Trajet traversant la couture ±180°
        GreatCircle.Point[] pts = GreatCircle.sample(10, 170, 10, -170, 33);
        for (GreatCircle.Point p : pts) {
            assertTrue(p.lon() >= -180.0 && p.lon() <= 180.0,
                    "longitude hors bornes : " + p.lon());
        }
        // Le trajet le plus court passe par la couture, pas par lon 0
        boolean traverse = false;
        for (GreatCircle.Point p : pts) {
            if (Math.abs(p.lon()) > 170.0) traverse = true;
        }
        assertTrue(traverse, "le trajet doit traverser la couture 180°");
    }
}
