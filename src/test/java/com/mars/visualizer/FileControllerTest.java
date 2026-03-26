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
import com.mars.visualizer.controller.CatalogController;
import com.mars.visualizer.controller.SliceController;
import com.mars.visualizer.controller.TimeSeriesController;
import com.mars.visualizer.controller.AnimationController;
import com.mars.visualizer.controller.ProfileController;
import com.mars.visualizer.controller.HovmollerController;
import com.mars.visualizer.controller.WindController;
import com.mars.visualizer.controller.DifferenceController;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.CatalogService;
import com.mars.visualizer.service.IndividualCatalogService;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.dto.internal.ProfileData;
import com.mars.visualizer.dto.internal.SliceData;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

@WebMvcTest({CatalogController.class, SliceController.class, TimeSeriesController.class,
		AnimationController.class, ProfileController.class, HovmollerController.class,
		WindController.class, DifferenceController.class})
class FileControllerTest {

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
    // Catalogue & health
    // =========================================================================

    @Nested
    @DisplayName("Catalogue & Health")
    class CatalogTests {

        @Test
        @DisplayName("GET /api/health retourne 200 avec version")
        void healthRetourne200AvecVersion() throws Exception {
            mockMvc.perform(get("/api/health"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").exists())
                    .andExpect(jsonPath("$.version").exists());
        }

        @Test
        @DisplayName("GET /api/catalog retourne 200")
        void catalogRetourne200() throws Exception {
            when(catalogService.getCatalog()).thenReturn(List.of());
            mockMvc.perform(get("/api/catalog"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("GET /api/catalog/individual retourne 200")
        void catalogIndividualRetourne200() throws Exception {
            when(individualCatalogService.getAvailableYears()).thenReturn(List.of());
            mockMvc.perform(get("/api/catalog/individual"))
                    .andExpect(status().isOk());
        }
    }

    // =========================================================================
    // Data endpoints — validation
    // =========================================================================

    @Nested
    @DisplayName("Data endpoints — validation")
    class ValidationTests {

        @Test
        @DisplayName("GET /api/data/slice sans dataset retourne 400")
        void sliceSansDatasetRetourne400() throws Exception {
            mockMvc.perform(get("/api/data/slice")
                            .param("variable", "TT")
                            .param("altitude", "49")
                            .param("time", "0"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/data/timeseries avec dataset INDIVIDUAL retourne 400")
        void timeseriesIndividualRetourne400() throws Exception {
            when(datasetResolver.isIndividualDataset("IND_MY34_LS5.00")).thenReturn(true);
            mockMvc.perform(get("/api/data/timeseries")
                            .param("dataset", "IND_MY34_LS5.00")
                            .param("variable", "TT")
                            .param("altitude", "49")
                            .param("latitude", "0")
                            .param("longitude", "0"))
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
        @DisplayName("GET /api/data/animation avec dataset INDIVIDUAL retourne 400")
        void animationIndividualRetourne400() throws Exception {
            when(datasetResolver.isIndividualDataset("IND_MY34_LS5.00")).thenReturn(true);
            mockMvc.perform(get("/api/data/animation")
                            .param("dataset", "IND_MY34_LS5.00")
                            .param("variable", "TT")
                            .param("altitude", "49"))
                    .andExpect(status().isBadRequest());
        }
    }

    // =========================================================================
    // Difference endpoint
    // =========================================================================

    @Nested
    @DisplayName("Difference endpoint")
    class DifferenceTests {

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
                    .andExpect(jsonPath("$.data[1][1]").value(20.0));
        }

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
    }

    // =========================================================================
    // Profile endpoint
    // =========================================================================

    @Nested
    @DisplayName("Profile endpoint")
    class ProfileTests {

        @Test
        @DisplayName("GET /api/data/profile avec dataset INDIVIDUAL retourne 200")
        void profileIndividualRetourne200() throws Exception {
            when(datasetResolver.resolveFilename("IND_MY34_LS5.00")).thenReturn("/fake/path.nc");
            when(datasetResolver.isIndividualDataset("IND_MY34_LS5.00")).thenReturn(true);
            when(datasetResolver.getActualLs("IND_MY34_LS5.00", "/fake/path.nc")).thenReturn(5.0);

            ProfileData profileData = new ProfileData(
                    List.of(1f), new double[]{0.0}, 0.0, 0.0);

            when(netcdfService.extractVerticalProfile(anyString(), anyString(), anyInt(), anyDouble(), anyDouble()))
                    .thenReturn(profileData);

            mockMvc.perform(get("/api/data/profile")
                            .param("dataset", "IND_MY34_LS5.00")
                            .param("variable", "TT")
                            .param("time", "0")
                            .param("latitude", "0")
                            .param("longitude", "0"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("GET /api/data/profile avec latitude invalide retourne 400")
        void profileLatitudeInvalideRetourne400() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);

            doThrow(new ValidationException("error.latitude.invalid", 999.0))
                    .when(validationService).validateLatitude(999.0);

            mockMvc.perform(get("/api/data/profile")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("time", "0")
                            .param("latitude", "999")
                            .param("longitude", "0"))
                    .andExpect(status().isBadRequest());
        }
    }

}
