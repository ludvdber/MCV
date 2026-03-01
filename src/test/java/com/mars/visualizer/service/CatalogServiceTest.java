package com.mars.visualizer.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.dto.response.DatasetMetadata;

import ucar.ma2.ArrayDouble;
import ucar.ma2.ArrayFloat;
import ucar.ma2.DataType;
import ucar.nc2.write.NetcdfFormatWriter;

/**
 * Tests unitaires pour CatalogService.
 *
 * Utilise un fichier NetCDF synthetique cree dans @TempDir pour
 * tester initCatalog(), getCatalog() et getFilenameById().
 * Les methodes privees (parseMarsYear, parseLsStart, buildMetadata)
 * sont testees indirectement via initCatalog.
 */
class CatalogServiceTest {

    @TempDir
    static Path tempDir;

    static CatalogService catalogService;

    @BeforeAll
    static void setUp() throws Exception {
        // Creer 2 fichiers NetCDF synthetiques avec des noms MEAN standards
        createMinimalNetCDF(tempDir.resolve("mean_MY28_Ls0_30.nc"), 2, 3, 2, 2);
        createMinimalNetCDF(tempDir.resolve("mean_MY28_Ls330_360.nc"), 2, 3, 2, 2);

        DataPathConfig pathConfig = mock(DataPathConfig.class);
        when(pathConfig.getMeanPath()).thenReturn(tempDir);

        NetCDFReaderService netcdfService = new NetCDFReaderService(pathConfig);
        catalogService = new CatalogService(pathConfig, netcdfService);
        catalogService.initCatalog();
    }

    // =========================================================================
    // Tests getCatalog
    // =========================================================================

    @Test
    @DisplayName("getCatalog retourne 2 datasets apres init")
    void getCatalog_returnsTwoDatasets() {
        List<DatasetMetadata> catalog = catalogService.getCatalog();
        assertEquals(2, catalog.size());
    }

    @Test
    @DisplayName("getCatalog retourne une liste non modifiable")
    void getCatalog_returnsUnmodifiableList() {
        List<DatasetMetadata> catalog = catalogService.getCatalog();
        assertThrows(UnsupportedOperationException.class, () -> catalog.add(null));
    }

    // =========================================================================
    // Tests extraction metadata (parseMarsYear, parseLsStart, lsEnd)
    // =========================================================================

    @Test
    @DisplayName("parseMarsYear extrait MY28 correctement")
    void initCatalog_parsesMarsYear() {
        DatasetMetadata ds = findDataset("mean_MY28_Ls0_30");
        assertNotNull(ds);
        assertEquals(28, ds.marsYear());
    }

    @Test
    @DisplayName("parseLsStart extrait Ls 0 et calcule lsEnd = 30")
    void initCatalog_parsesLsRange_normalCase() {
        DatasetMetadata ds = findDataset("mean_MY28_Ls0_30");
        assertNotNull(ds);
        assertEquals(0, ds.lsStart());
        assertEquals(30, ds.lsEnd());
    }

    @Test
    @DisplayName("lsEnd = 360 quand lsStart = 330 (dernier segment)")
    void initCatalog_parsesLsRange_lastSegment() {
        DatasetMetadata ds = findDataset("mean_MY28_Ls330_360");
        assertNotNull(ds);
        assertEquals(330, ds.lsStart());
        assertEquals(360, ds.lsEnd());
    }

    // =========================================================================
    // Tests dimensions et variables
    // =========================================================================

    @Test
    @DisplayName("buildMetadata extrait les dimensions correctes")
    void initCatalog_extractsDimensions() {
        DatasetMetadata ds = findDataset("mean_MY28_Ls0_30");
        assertNotNull(ds.dimensions());
        assertEquals(2, ds.dimensions().get("time"));
        assertEquals(2, ds.dimensions().get("lat"));
        assertEquals(2, ds.dimensions().get("lon"));
        assertEquals(3, ds.dimensions().get("altitude"));
    }

    @Test
    @DisplayName("buildMetadata extrait les noms de variables")
    void initCatalog_extractsVariables() {
        DatasetMetadata ds = findDataset("mean_MY28_Ls0_30");
        assertNotNull(ds.variables());
        assertTrue(ds.variables().contains("TT"));
        assertTrue(ds.variables().contains("lat"));
        assertTrue(ds.variables().contains("lon"));
    }

    // =========================================================================
    // Tests getFilenameById
    // =========================================================================

    @Test
    @DisplayName("getFilenameById retourne le fichier pour un ID existant")
    void getFilenameById_existingId() {
        Optional<String> result = catalogService.getFilenameById("mean_MY28_Ls0_30");
        assertTrue(result.isPresent());
        assertEquals("mean_MY28_Ls0_30.nc", result.get());
    }

    @Test
    @DisplayName("getFilenameById retourne empty pour un ID inconnu")
    void getFilenameById_unknownId() {
        Optional<String> result = catalogService.getFilenameById("nonexistent");
        assertTrue(result.isEmpty());
    }

    // =========================================================================
    // Tests edge cases
    // =========================================================================

    @Test
    @DisplayName("initCatalog sur repertoire vide produit un catalogue vide")
    void initCatalog_emptyDirectory() throws Exception {
        Path emptyDir = tempDir.resolve("empty");
        java.nio.file.Files.createDirectories(emptyDir);

        DataPathConfig emptyConfig = mock(DataPathConfig.class);
        when(emptyConfig.getMeanPath()).thenReturn(emptyDir);

        NetCDFReaderService emptyReader = new NetCDFReaderService(emptyConfig);
        CatalogService emptyService = new CatalogService(emptyConfig, emptyReader);
        emptyService.initCatalog();

        assertTrue(emptyService.getCatalog().isEmpty());
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private DatasetMetadata findDataset(String id) {
        return catalogService.getCatalog().stream()
                .filter(ds -> ds.id().equals(id))
                .findFirst()
                .orElse(null);
    }

    /**
     * Cree un fichier NetCDF minimal avec les dimensions standard.
     */
    private static void createMinimalNetCDF(Path path, int nTime, int nAlt, int nLat, int nLon) throws Exception {
        NetcdfFormatWriter.Builder builder =
                NetcdfFormatWriter.createNewNetcdf3(path.toString());

        builder.addDimension("time", nTime);
        builder.addDimension("altitude", nAlt);
        builder.addDimension("lat", nLat);
        builder.addDimension("lon", nLon);

        builder.addVariable("TT", DataType.FLOAT, "time altitude lat lon");
        builder.addVariable("lat", DataType.DOUBLE, "lat");
        builder.addVariable("lon", DataType.DOUBLE, "lon");
        builder.addVariable("altitude", DataType.DOUBLE, "altitude");

        try (NetcdfFormatWriter writer = builder.build()) {
            // Remplir lat
            ArrayDouble.D1 latData = new ArrayDouble.D1(nLat);
            for (int i = 0; i < nLat; i++) latData.set(i, -45.0 + i * 90.0);
            writer.write(writer.findVariable("lat"), latData);

            // Remplir lon
            ArrayDouble.D1 lonData = new ArrayDouble.D1(nLon);
            for (int i = 0; i < nLon; i++) lonData.set(i, -90.0 + i * 180.0);
            writer.write(writer.findVariable("lon"), lonData);

            // Remplir altitude
            ArrayDouble.D1 altData = new ArrayDouble.D1(nAlt);
            for (int i = 0; i < nAlt; i++) altData.set(i, 10.0 * (i + 1));
            writer.write(writer.findVariable("altitude"), altData);

            // Remplir TT avec des valeurs sequentielles
            ArrayFloat.D4 ttData = new ArrayFloat.D4(nTime, nAlt, nLat, nLon);
            float val = 1;
            for (int t = 0; t < nTime; t++)
                for (int a = 0; a < nAlt; a++)
                    for (int la = 0; la < nLat; la++)
                        for (int lo = 0; lo < nLon; lo++)
                            ttData.set(t, a, la, lo, val++);
            writer.write(writer.findVariable("TT"), ttData);
        }
    }
}
