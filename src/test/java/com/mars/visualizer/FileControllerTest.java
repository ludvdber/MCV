package com.mars.visualizer;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.controller.FileController;
import com.mars.visualizer.service.CatalogService;
import com.mars.visualizer.service.IndividualCatalogService;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.NetCDFReaderService.ProfileData;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

@WebMvcTest(FileController.class)
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

    // =========================================================================
    // Data endpoints
    // =========================================================================

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
}
