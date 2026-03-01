package com.mars.visualizer;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.controller.ExportController;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

@WebMvcTest(ExportController.class)
class ExportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private NetCDFReaderService netcdfService;

    @MockitoBean
    private ValidationService validationService;

    @MockitoBean
    private DataPathConfig dataPathConfig;

    @MockitoBean
    private DatasetResolver datasetResolver;

    @Test
    @DisplayName("Export CSV crosssection avec fixedCoordinate invalide retourne 400")
    void crosssectionFixedCoordinateInvalideRetourne400() throws Exception {
        when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");
        when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);

        doThrow(new ValidationException("error.longitude.invalid", 999.0))
                .when(validationService).validateLongitude(999.0);

        mockMvc.perform(get("/api/export/csv/crosssection")
                        .param("dataset", "mean_MY28_Ls0_30")
                        .param("variable", "TT")
                        .param("time", "0")
                        .param("type", "meridional")
                        .param("fixedCoordinate", "999"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Export CSV crosssection avec type invalide retourne 400")
    void crosssectionTypeInvalideRetourne400() throws Exception {
        when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");
        when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);

        mockMvc.perform(get("/api/export/csv/crosssection")
                        .param("dataset", "mean_MY28_Ls0_30")
                        .param("variable", "TT")
                        .param("time", "0")
                        .param("type", "diagonal")
                        .param("fixedCoordinate", "45"))
                .andExpect(status().isBadRequest());
    }
}
