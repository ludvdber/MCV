package com.mars.visualizer.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.exception.NetCDFException;
import com.mars.visualizer.service.NetCDFReaderService.ProfileData;
import com.mars.visualizer.service.NetCDFReaderService.SliceData;

import ucar.ma2.ArrayDouble;
import ucar.ma2.ArrayFloat;
import ucar.ma2.DataType;
import ucar.nc2.write.NetcdfFormatWriter;

/**
 * Tests unitaires et d'intégration pour NetCDFReaderService.
 *
 * GROUPE 1 — Tests unitaires purs (assertPathSafe, findNearestIndex).
 * GROUPE 2 — Tests avec fichier NetCDF synthétique créé dans @TempDir.
 *
 * Note : getActualLs est dans IndividualCatalogService, déjà couvert
 * par IndividualCatalogServiceTest (2 tests existants).
 */
class NetCDFReaderServiceTest {

    @TempDir
    static Path tempDir;

    static NetCDFReaderService service;
    static String testFileName;

    @BeforeAll
    static void setUp() throws Exception {
        Path ncFile = tempDir.resolve("test.nc");
        testFileName = "test.nc";

        // Créer un fichier NetCDF synthétique minimal :
        //   dims : time=2, altitudeT=3, lat=2, lon=2
        //   var TT(time, altitudeT, lat, lon) : float, valeurs 1..24
        //   var lat : [-45.0, 45.0]
        //   var lon : [-90.0, 90.0]
        //   var altitudeT : [10.0, 20.0, 30.0] (km)
        NetcdfFormatWriter.Builder builder =
                NetcdfFormatWriter.createNewNetcdf3(ncFile.toString());

        builder.addDimension("time", 2);
        builder.addDimension("altitudeT", 3);
        builder.addDimension("lat", 2);
        builder.addDimension("lon", 2);

        builder.addVariable("TT", DataType.FLOAT, "time altitudeT lat lon");
        builder.addVariable("lat", DataType.DOUBLE, "lat");
        builder.addVariable("lon", DataType.DOUBLE, "lon");
        builder.addVariable("altitudeT", DataType.DOUBLE, "altitudeT");

        try (NetcdfFormatWriter writer = builder.build()) {
            // TT : valeurs sequentielles 1..24
            ArrayFloat.D4 ttData = new ArrayFloat.D4(2, 3, 2, 2);
            float value = 1.0f;
            for (int t = 0; t < 2; t++)
                for (int a = 0; a < 3; a++)
                    for (int lat = 0; lat < 2; lat++)
                        for (int lon = 0; lon < 2; lon++)
                            ttData.set(t, a, lat, lon, value++);
            writer.write(writer.findVariable("TT"), ttData);

            ArrayDouble.D1 latArr = new ArrayDouble.D1(2);
            latArr.set(0, -45.0);
            latArr.set(1, 45.0);
            writer.write(writer.findVariable("lat"), latArr);

            ArrayDouble.D1 lonArr = new ArrayDouble.D1(2);
            lonArr.set(0, -90.0);
            lonArr.set(1, 90.0);
            writer.write(writer.findVariable("lon"), lonArr);

            ArrayDouble.D1 altArr = new ArrayDouble.D1(3);
            altArr.set(0, 10.0);
            altArr.set(1, 20.0);
            altArr.set(2, 30.0);
            writer.write(writer.findVariable("altitudeT"), altArr);
        }

        DataPathConfig config = mock(DataPathConfig.class);
        when(config.getMeanPath()).thenReturn(tempDir);
        when(config.getIndividualPath()).thenReturn(tempDir);
        service = new NetCDFReaderService(config);
    }

    // =========================================================================
    // GROUPE 1 — Tests unitaires purs
    // =========================================================================

    @Test
    @DisplayName("assertPathSafe accepte un chemin dans le dossier autorisé")
    void assertPathSafe_accepteCheminAutorise() {
        Path file = tempDir.resolve("test.nc");
        assertDoesNotThrow(() -> service.assertPathSafe(file, tempDir));
    }

    @Test
    @DisplayName("assertPathSafe rejette un chemin hors du dossier autorisé")
    void assertPathSafe_rejetteCheminHors() {
        Path evil = tempDir.resolve("../../etc/passwd");
        assertThrows(NetCDFException.class, () -> service.assertPathSafe(evil, tempDir));
    }

    @Test
    @DisplayName("assertPathSafe rejette un chemin avec traversal normalisé (..)")
    void assertPathSafe_rejetteTraversalNormalise() {
        Path evil = tempDir.resolve("subdir/../../../etc");
        assertThrows(NetCDFException.class, () -> service.assertPathSafe(evil, tempDir));
    }

    @Test
    @DisplayName("findNearestIndex retourne l'index le plus proche")
    void findNearestIndex_retourneIndexProche() {
        double[] coords = {-45.0, 0.0, 45.0, 90.0};
        assertEquals(1, service.findNearestIndex(coords, -10.0));
        assertEquals(0, service.findNearestIndex(coords, -45.0));
        assertEquals(3, service.findNearestIndex(coords, 100.0));
    }

    @Test
    @DisplayName("findNearestIndex lève exception pour tableau vide")
    void findNearestIndex_leveExceptionTableauVide() {
        assertThrows(NetCDFException.class, () ->
                service.findNearestIndex(new double[0], 0.0));
    }

    @Test
    @DisplayName("findNearestIndex lève exception pour tableau null")
    void findNearestIndex_leveExceptionNull() {
        assertThrows(NetCDFException.class, () ->
                service.findNearestIndex(null, 0.0));
    }

    // =========================================================================
    // GROUPE 2 — Tests avec fichier NetCDF synthétique
    // =========================================================================

    @Test
    @DisplayName("extractSlice2D retourne une matrice 2×2 pour les dimensions du fichier test")
    void extractSlice2D_retourneMatrice2x2() {
        SliceData slice = service.extractSlice2DWithCoords(testFileName, "TT", 0, 0);
        assertEquals(2, slice.data().length);
        assertEquals(2, slice.data()[0].length);
        // time=0, alt=0 : valeurs 1, 2, 3, 4
        assertEquals(1.0f, slice.data()[0][0], 0.001f);
        assertEquals(2.0f, slice.data()[0][1], 0.001f);
        assertEquals(3.0f, slice.data()[1][0], 0.001f);
        assertEquals(4.0f, slice.data()[1][1], 0.001f);
    }

    @Test
    @DisplayName("extractTimeSeries retourne 2 valeurs pour time=2")
    void extractTimeSeries_retourne2Valeurs() {
        List<Float> series = service.extractTimeSeries(testFileName, "TT", -45.0, -90.0, 0);
        assertEquals(2, series.size());
        // t=0, alt=0, lat=0, lon=0 → 1.0
        assertEquals(1.0f, series.get(0), 0.001f);
        // t=1, alt=0, lat=0, lon=0 → 13.0 (12 valeurs par timestep + 1)
        assertEquals(13.0f, series.get(1), 0.001f);
    }

    @Test
    @DisplayName("extractVerticalProfile retourne 3 valeurs pour altitudeT=3")
    void extractVerticalProfile_retourne3Valeurs() {
        ProfileData profile = service.extractVerticalProfile(testFileName, "TT", 0, -45.0, -90.0);
        assertEquals(3, profile.values().size());
        // alt=0 → 1.0, alt=1 → 5.0, alt=2 → 9.0 (stride de 4 entre niveaux)
        assertEquals(1.0f, profile.values().get(0), 0.001f);
        assertEquals(5.0f, profile.values().get(1), 0.001f);
        assertEquals(9.0f, profile.values().get(2), 0.001f);
    }
}
