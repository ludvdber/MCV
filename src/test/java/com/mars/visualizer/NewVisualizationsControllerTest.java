package com.mars.visualizer;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.controller.HovmollerController;
import com.mars.visualizer.controller.ZonalMeanController;
import com.mars.visualizer.controller.WindController;
import com.mars.visualizer.controller.DifferenceController;
import com.mars.visualizer.controller.ProfileController;
import com.mars.visualizer.dto.internal.HovmollerData;
import com.mars.visualizer.dto.internal.SliceData;
import com.mars.visualizer.dto.internal.TemporalProfileData;
import com.mars.visualizer.dto.internal.WindRoseData;
import com.mars.visualizer.dto.internal.ZonalMeanData;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.CatalogService;
import com.mars.visualizer.service.IndividualCatalogService;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

@WebMvcTest({HovmollerController.class, ZonalMeanController.class, WindController.class,
        DifferenceController.class, ProfileController.class})
class NewVisualizationsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private NetCDFReaderService netcdfService;

    @MockitoBean
    private CatalogService catalogService;

    @MockitoBean
    private IndividualCatalogService individualCatalogService;

    @MockitoBean
    private ValidationService validationService;

    @MockitoBean
    private DataPathConfig dataPathConfig;

    @MockitoBean
    private DatasetResolver datasetResolver;

    // =========================================================================
    // Hovmoller endpoint
    // =========================================================================

    @Nested
    @DisplayName("Hovmoller endpoint")
    class HovmollerTests {

        @Test
        @DisplayName("GET /api/data/hovmoller sans dataset retourne 400")
        void hovmollerSansDatasetRetourne400() throws Exception {
            mockMvc.perform(get("/api/data/hovmoller")
                            .param("variable", "TT")
                            .param("altitude", "0")
                            .param("type", "latitude"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/hovmoller avec dataset INDIVIDUAL retourne 400")
        void hovmollerIndividualRetourne400() throws Exception {
            when(datasetResolver.isIndividualDataset("IND_MY34_LS5.00")).thenReturn(true);
            mockMvc.perform(get("/api/data/hovmoller")
                            .param("dataset", "IND_MY34_LS5.00")
                            .param("variable", "TT")
                            .param("altitude", "49")
                            .param("type", "latitude"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/hovmoller avec type invalide retourne 400")
        void hovmollerTypeInvalideRetourne400() throws Exception {
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);
            mockMvc.perform(get("/api/data/hovmoller")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("altitude", "0")
                            .param("type", "diagonal"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/hovmoller avec altitude invalide retourne 400")
        void hovmollerAltitudeInvalideRetourne400() throws Exception {
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");

            doThrow(new ValidationException("error.altitude.invalid", 999, 0, 102))
                    .when(validationService).validateAltitude(999);

            mockMvc.perform(get("/api/data/hovmoller")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("altitude", "999")
                            .param("type", "latitude"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/hovmoller avec params valides retourne 200")
        void hovmollerParamsValidesRetourne200() throws Exception {
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");

            HovmollerData hovData = new HovmollerData(
                    new float[][]{{10f, 20f}, {30f, 40f}},
                    new double[]{0.0, 0.5},
                    new double[]{-45, 45});

            when(netcdfService.extractHovmoller("/fake/path.nc", "TT", 0, "latitude"))
                    .thenReturn(hovData);
            when(netcdfService.extractAltitudeValue("/fake/path.nc", "TT", 0))
                    .thenReturn(10.0);

            mockMvc.perform(get("/api/data/hovmoller")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("altitude", "0")
                            .param("type", "latitude"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.dataset").value("mean_MY28_Ls0_30"))
                    .andExpect(jsonPath("$.variable").value("TT"))
                    .andExpect(jsonPath("$.type").value("latitude"))
                    .andExpect(jsonPath("$.data[0][0]").value(10.0))
                    .andExpect(jsonPath("$.stats").exists());
        }
    }

    // =========================================================================
    // Zonal Mean endpoint
    // =========================================================================

    @Nested
    @DisplayName("Zonal Mean endpoint")
    class ZonalMeanTests {

        @Test
        @DisplayName("GET /api/data/zonalmean sans dataset retourne 400")
        void zonalmeanSansDatasetRetourne400() throws Exception {
            mockMvc.perform(get("/api/data/zonalmean")
                            .param("variable", "TT")
                            .param("time", "0"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/zonalmean avec timestep invalide retourne 400")
        void zonalmeanTimestepInvalideRetourne400() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);

            doThrow(new ValidationException("error.timestep.invalid", 99, 0, 47))
                    .when(validationService).validateTimestep(99);

            mockMvc.perform(get("/api/data/zonalmean")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("time", "99"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/zonalmean avec params valides retourne 200")
        void zonalmeanParamsValidesRetourne200() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);
            when(datasetResolver.getActualLs("mean_MY28_Ls0_30", "/fake/path.nc")).thenReturn(15.0);

            ZonalMeanData zmData = new ZonalMeanData(
                    new float[][]{{100f, 200f}, {300f, 400f}},
                    new double[]{-45, 45},
                    new double[]{0.1, 10.0});

            when(netcdfService.extractZonalMean("/fake/path.nc", "TT", 0))
                    .thenReturn(zmData);

            mockMvc.perform(get("/api/data/zonalmean")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("time", "0"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.dataset").value("mean_MY28_Ls0_30"))
                    .andExpect(jsonPath("$.variable").value("TT"))
                    .andExpect(jsonPath("$.data[0][0]").value(100.0))
                    .andExpect(jsonPath("$.stats").exists());
        }

        @Test
        @DisplayName("GET /api/data/zonalmean avec dataset INDIVIDUAL ajuste time a 0")
        void zonalmeanIndividualAdjusteTime() throws Exception {
            when(datasetResolver.resolveFilename("IND_MY34_LS5.00")).thenReturn("/fake/ind.nc");
            when(datasetResolver.isIndividualDataset("IND_MY34_LS5.00")).thenReturn(true);
            when(datasetResolver.getActualLs("IND_MY34_LS5.00", "/fake/ind.nc")).thenReturn(5.0);

            ZonalMeanData zmData = new ZonalMeanData(
                    new float[][]{{50f}},
                    new double[]{0.0},
                    new double[]{1.0});

            when(netcdfService.extractZonalMean("/fake/ind.nc", "TT", 0))
                    .thenReturn(zmData);

            mockMvc.perform(get("/api/data/zonalmean")
                            .param("dataset", "IND_MY34_LS5.00")
                            .param("variable", "TT")
                            .param("time", "5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.dataset").value("IND_MY34_LS5.00"));
        }
    }

    // =========================================================================
    // Wind Rose endpoint
    // =========================================================================

    @Nested
    @DisplayName("Wind Rose endpoint")
    class WindRoseTests {

        @Test
        @DisplayName("GET /api/data/windrose sans dataset retourne 400")
        void windroseSansDatasetRetourne400() throws Exception {
            mockMvc.perform(get("/api/data/windrose")
                            .param("latitude", "0")
                            .param("longitude", "0")
                            .param("altitude", "49"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/windrose sans latitude retourne 400")
        void windroseSansLatitudeRetourne400() throws Exception {
            mockMvc.perform(get("/api/data/windrose")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("longitude", "0")
                            .param("altitude", "49"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/windrose avec dataset INDIVIDUAL retourne 400")
        void windroseIndividualRetourne400() throws Exception {
            when(datasetResolver.isIndividualDataset("IND_MY34_LS5.00")).thenReturn(true);
            mockMvc.perform(get("/api/data/windrose")
                            .param("dataset", "IND_MY34_LS5.00")
                            .param("latitude", "0")
                            .param("longitude", "0")
                            .param("altitude", "49"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/windrose avec latitude invalide retourne 400")
        void windroseLatitudeInvalideRetourne400() throws Exception {
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");

            doThrow(new ValidationException("error.latitude.invalid", 999.0))
                    .when(validationService).validateLatitude(999.0);

            mockMvc.perform(get("/api/data/windrose")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("latitude", "999")
                            .param("longitude", "0")
                            .param("altitude", "49"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/windrose avec params valides retourne 200")
        void windroseParamsValidesRetourne200() throws Exception {
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");

            WindRoseData wrData = new WindRoseData(
                    List.of(1.0f, 2.0f, 3.0f),
                    List.of(-1.0f, -2.0f, -3.0f),
                    0.0, 0.0);

            when(netcdfService.extractWindRose("/fake/path.nc", 0.0, 0.0, 49))
                    .thenReturn(wrData);
            when(netcdfService.extractAltitudeValue("/fake/path.nc", "UU", 49))
                    .thenReturn(5.0);

            mockMvc.perform(get("/api/data/windrose")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("latitude", "0")
                            .param("longitude", "0")
                            .param("altitude", "49"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.dataset").value("mean_MY28_Ls0_30"))
                    .andExpect(jsonPath("$.uu[0]").value(1.0))
                    .andExpect(jsonPath("$.vv[0]").value(-1.0))
                    .andExpect(jsonPath("$.actualLat").value(0.0))
                    .andExpect(jsonPath("$.actualLon").value(0.0));
        }
    }

    // =========================================================================
    // Difference endpoint
    // =========================================================================

    @Nested
    @DisplayName("Difference endpoint")
    class DifferenceTests {

        @Test
        @DisplayName("GET /api/data/difference sans datasetA retourne 400")
        void differenceSansDatasetARetourne400() throws Exception {
            mockMvc.perform(get("/api/data/difference")
                            .param("datasetB", "mean_MY28_Ls30_60"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/difference sans datasetB retourne 400")
        void differenceSansDatasetBRetourne400() throws Exception {
            mockMvc.perform(get("/api/data/difference")
                            .param("datasetA", "mean_MY28_Ls0_30"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/difference avec altitude invalide retourne 400")
        void differenceAltitudeInvalideRetourne400() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/a.nc");
            when(datasetResolver.resolveFilename("mean_MY28_Ls30_60")).thenReturn("/fake/b.nc");
            when(datasetResolver.isIndividualDataset(anyString())).thenReturn(false);

            doThrow(new ValidationException("error.altitude.invalid", 999, 0, 102))
                    .when(validationService).validateAltitude(999);

            mockMvc.perform(get("/api/data/difference")
                            .param("datasetA", "mean_MY28_Ls0_30")
                            .param("datasetB", "mean_MY28_Ls30_60")
                            .param("variable", "TT")
                            .param("time", "0")
                            .param("altitude", "999"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/difference avec timestep invalide retourne 400")
        void differenceTimestepInvalideRetourne400() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/a.nc");
            when(datasetResolver.resolveFilename("mean_MY28_Ls30_60")).thenReturn("/fake/b.nc");
            when(datasetResolver.isIndividualDataset(anyString())).thenReturn(false);

            doThrow(new ValidationException("error.timestep.invalid", 99, 0, 47))
                    .when(validationService).validateTimestep(99);

            mockMvc.perform(get("/api/data/difference")
                            .param("datasetA", "mean_MY28_Ls0_30")
                            .param("datasetB", "mean_MY28_Ls30_60")
                            .param("variable", "TT")
                            .param("time", "99")
                            .param("altitude", "0"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/difference avec params valides retourne 200")
        void differenceParamsValidesRetourne200() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/a.nc");
            when(datasetResolver.resolveFilename("mean_MY28_Ls30_60")).thenReturn("/fake/b.nc");
            when(datasetResolver.isIndividualDataset(anyString())).thenReturn(false);
            when(datasetResolver.getActualLs(anyString(), anyString())).thenReturn(5.0);

            SliceData sliceA = new SliceData(
                    new float[][]{{10f, 20f}, {30f, 40f}},
                    new double[]{-45, 45}, new double[]{-90, 90});
            SliceData sliceB = new SliceData(
                    new float[][]{{5f, 10f}, {15f, 20f}},
                    new double[]{-45, 45}, new double[]{-90, 90});

            when(netcdfService.extractSlice2DWithCoords("/fake/a.nc", "TT", 0, 0))
                    .thenReturn(sliceA);
            when(netcdfService.extractSlice2DWithCoords("/fake/b.nc", "TT", 0, 0))
                    .thenReturn(sliceB);
            when(netcdfService.extractAltitudeValue(anyString(), anyString(), anyInt()))
                    .thenReturn(10.0);

            mockMvc.perform(get("/api/data/difference")
                            .param("datasetA", "mean_MY28_Ls0_30")
                            .param("datasetB", "mean_MY28_Ls30_60")
                            .param("variable", "TT")
                            .param("time", "0")
                            .param("altitude", "0"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.datasetA").value("mean_MY28_Ls0_30"))
                    .andExpect(jsonPath("$.datasetB").value("mean_MY28_Ls30_60"))
                    .andExpect(jsonPath("$.data[0][0]").value(5.0))
                    .andExpect(jsonPath("$.data[0][1]").value(10.0))
                    .andExpect(jsonPath("$.data[1][0]").value(15.0))
                    .andExpect(jsonPath("$.data[1][1]").value(20.0))
                    .andExpect(jsonPath("$.stats").exists());
        }
    }

    // =========================================================================
    // Temporal Profile endpoint
    // =========================================================================

    @Nested
    @DisplayName("Temporal Profile endpoint")
    class TemporalProfileTests {

        @Test
        @DisplayName("GET /api/data/temporal-profile sans dataset retourne 400")
        void temporalProfileSansDatasetRetourne400() throws Exception {
            mockMvc.perform(get("/api/data/temporal-profile")
                            .param("variable", "TT")
                            .param("latitude", "0")
                            .param("longitude", "0"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/temporal-profile sans latitude retourne 400")
        void temporalProfileSansLatitudeRetourne400() throws Exception {
            mockMvc.perform(get("/api/data/temporal-profile")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("longitude", "0"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/temporal-profile sans longitude retourne 400")
        void temporalProfileSansLongitudeRetourne400() throws Exception {
            mockMvc.perform(get("/api/data/temporal-profile")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("latitude", "0"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/temporal-profile avec latitude invalide retourne 400")
        void temporalProfileLatitudeInvalideRetourne400() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);

            doThrow(new ValidationException("error.latitude.invalid", 999.0))
                    .when(validationService).validateLatitude(999.0);

            mockMvc.perform(get("/api/data/temporal-profile")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("latitude", "999")
                            .param("longitude", "0"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/temporal-profile avec longitude invalide retourne 400")
        void temporalProfileLongitudeInvalideRetourne400() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);

            doThrow(new ValidationException("error.longitude.invalid", 999.0))
                    .when(validationService).validateLongitude(999.0);

            mockMvc.perform(get("/api/data/temporal-profile")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("latitude", "0")
                            .param("longitude", "999"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/temporal-profile avec params valides retourne 200")
        void temporalProfileParamsValidesRetourne200() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);
            when(datasetResolver.getActualLs("mean_MY28_Ls0_30", "/fake/path.nc")).thenReturn(15.0);

            TemporalProfileData tpData = new TemporalProfileData(
                    new float[][]{{200f, 210f}, {220f, 230f}},
                    new double[]{0.1, 10.0},
                    0.0, 0.0);

            when(netcdfService.extractTemporalProfile("/fake/path.nc", "TT", 0.0, 0.0))
                    .thenReturn(tpData);

            mockMvc.perform(get("/api/data/temporal-profile")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("latitude", "0")
                            .param("longitude", "0"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.dataset").value("mean_MY28_Ls0_30"))
                    .andExpect(jsonPath("$.variable").value("TT"))
                    .andExpect(jsonPath("$.latitude").value(0.0))
                    .andExpect(jsonPath("$.longitude").value(0.0))
                    .andExpect(jsonPath("$.data[0][0]").value(200.0))
                    .andExpect(jsonPath("$.altitudes").isArray())
                    .andExpect(jsonPath("$.times").isArray())
                    .andExpect(jsonPath("$.stats").exists());
        }

        @Test
        @DisplayName("GET /api/data/temporal-profile avec dataset INDIVIDUAL ajuste time a 0")
        void temporalProfileIndividualRetourne200() throws Exception {
            when(datasetResolver.resolveFilename("IND_MY34_LS5.00")).thenReturn("/fake/ind.nc");
            when(datasetResolver.isIndividualDataset("IND_MY34_LS5.00")).thenReturn(true);
            when(datasetResolver.getActualLs("IND_MY34_LS5.00", "/fake/ind.nc")).thenReturn(5.0);

            TemporalProfileData tpData = new TemporalProfileData(
                    new float[][]{{100f}},
                    new double[]{1.0},
                    0.0, 0.0);

            when(netcdfService.extractTemporalProfile("/fake/ind.nc", "TT", 0.0, 0.0))
                    .thenReturn(tpData);

            mockMvc.perform(get("/api/data/temporal-profile")
                            .param("dataset", "IND_MY34_LS5.00")
                            .param("variable", "TT")
                            .param("latitude", "0")
                            .param("longitude", "0"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.dataset").value("IND_MY34_LS5.00"));
        }
    }
}
