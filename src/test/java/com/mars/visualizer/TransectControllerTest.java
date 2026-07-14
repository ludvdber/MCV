package com.mars.visualizer;

import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.controller.TransectController;
import com.mars.visualizer.dto.internal.TransectData;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.CatalogService;
import com.mars.visualizer.service.IndividualCatalogService;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

@WebMvcTest(TransectController.class)
class TransectControllerTest {

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

    private static final String DS = "mean_MY28_Ls0_30";

    private TransectData fakeData() {
        return new TransectData(
                new float[][]{{210f, 215f, 220f}, {180f, 182f, 184f}},
                new double[]{1.0, 10.0},
                new double[]{0.0, 250.0, 500.0},
                new double[]{-10.0, 0.0, 10.0},
                new double[]{20.0, 25.0, 30.0});
    }

    @Test
    @DisplayName("GET /api/data/transect sans dataset retourne 400")
    void transectSansDatasetRetourne400() throws Exception {
        mockMvc.perform(get("/api/data/transect")
                        .param("variable", "TT")
                        .param("lat1", "0").param("lon1", "0")
                        .param("lat2", "10").param("lon2", "10"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/data/transect avec latitude invalide retourne 400")
    void transectLatitudeInvalideRetourne400() throws Exception {
        when(datasetResolver.resolveFilename(DS)).thenReturn("/fake/path.nc");
        when(datasetResolver.isIndividualDataset(DS)).thenReturn(false);

        doThrow(new ValidationException("error.latitude.invalid", 999.0))
                .when(validationService).validateLatitude(999.0);

        mockMvc.perform(get("/api/data/transect")
                        .param("dataset", DS)
                        .param("variable", "TT")
                        .param("lat1", "999").param("lon1", "0")
                        .param("lat2", "10").param("lon2", "10"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/data/transect avec params valides retourne 200")
    void transectParamsValidesRetourne200() throws Exception {
        when(datasetResolver.resolveFilename(DS)).thenReturn("/fake/path.nc");
        when(datasetResolver.isIndividualDataset(DS)).thenReturn(false);
        when(datasetResolver.getActualLs(DS, "/fake/path.nc")).thenReturn(15.0);

        when(netcdfService.extractTransect(eq("/fake/path.nc"), eq("TT"), eq(0),
                eq(-10.0), eq(20.0), eq(10.0), eq(30.0), eq(96)))
                .thenReturn(fakeData());

        mockMvc.perform(get("/api/data/transect")
                        .param("dataset", DS)
                        .param("variable", "TT")
                        .param("time", "0")
                        .param("lat1", "-10").param("lon1", "20")
                        .param("lat2", "10").param("lon2", "30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataset").value(DS))
                .andExpect(jsonPath("$.variable").value("TT"))
                .andExpect(jsonPath("$.data[0][0]").value(210.0))
                .andExpect(jsonPath("$.distances[2]").value(500.0))
                .andExpect(jsonPath("$.altitudes[1]").value(10.0))
                .andExpect(jsonPath("$.lats[0]").value(-10.0))
                .andExpect(jsonPath("$.stats").exists());
    }

    @Test
    @DisplayName("GET /api/data/transect borne le nombre de points demande")
    void transectClampePoints() throws Exception {
        when(datasetResolver.resolveFilename(DS)).thenReturn("/fake/path.nc");
        when(datasetResolver.isIndividualDataset(DS)).thenReturn(false);
        when(datasetResolver.getActualLs(DS, "/fake/path.nc")).thenReturn(15.0);

        // points=99999 doit etre borne a 181 avant l'appel au service
        when(netcdfService.extractTransect(anyString(), anyString(), anyInt(),
                anyDouble(), anyDouble(), anyDouble(), anyDouble(), eq(181)))
                .thenReturn(fakeData());

        mockMvc.perform(get("/api/data/transect")
                        .param("dataset", DS)
                        .param("variable", "TT")
                        .param("lat1", "-10").param("lon1", "20")
                        .param("lat2", "10").param("lon2", "30")
                        .param("points", "99999"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("GET /api/data/transect sur variable de surface retourne 400")
    void transectVariableSurfaceRetourne400() throws Exception {
        when(datasetResolver.resolveFilename(DS)).thenReturn("/fake/path.nc");
        when(datasetResolver.isIndividualDataset(DS)).thenReturn(false);

        when(netcdfService.extractTransect(anyString(), anyString(), anyInt(),
                anyDouble(), anyDouble(), anyDouble(), anyDouble(), anyInt()))
                .thenThrow(new ValidationException("error.netcdf.surface.no.transect", "P0"));

        mockMvc.perform(get("/api/data/transect")
                        .param("dataset", DS)
                        .param("variable", "P0")
                        .param("lat1", "-10").param("lon1", "20")
                        .param("lat2", "10").param("lon2", "30"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/data/transect avec dataset INDIVIDUAL ajuste time a 0")
    void transectIndividualAdjusteTime() throws Exception {
        when(datasetResolver.resolveFilename("IND_MY34_LS5.00")).thenReturn("/fake/ind.nc");
        when(datasetResolver.isIndividualDataset("IND_MY34_LS5.00")).thenReturn(true);
        when(datasetResolver.getActualLs("IND_MY34_LS5.00", "/fake/ind.nc")).thenReturn(5.0);

        when(netcdfService.extractTransect(eq("/fake/ind.nc"), eq("TT"), eq(0),
                anyDouble(), anyDouble(), anyDouble(), anyDouble(), anyInt()))
                .thenReturn(fakeData());

        mockMvc.perform(get("/api/data/transect")
                        .param("dataset", "IND_MY34_LS5.00")
                        .param("variable", "TT")
                        .param("time", "30")
                        .param("lat1", "-10").param("lon1", "20")
                        .param("lat2", "10").param("lon2", "30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataset").value("IND_MY34_LS5.00"));
    }
}
