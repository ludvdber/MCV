package com.mars.visualizer;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.controller.ExportController;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.NetCDFWriterService;
import com.mars.visualizer.dto.internal.SliceData;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

@WebMvcTest(ExportController.class)
class ExportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private NetCDFReaderService netcdfService;

    @MockitoBean
    private NetCDFWriterService netcdfWriter;

    @MockitoBean
    private ValidationService validationService;

    @MockitoBean
    private DataPathConfig dataPathConfig;

    @MockitoBean
    private DatasetResolver datasetResolver;

    // =========================================================================
    // Cross-section export
    // =========================================================================

    @Nested
    @DisplayName("Cross-section CSV export")
    class CrossSectionExport {

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

    // =========================================================================
    // Difference export
    // =========================================================================

    @Nested
    @DisplayName("Difference CSV export")
    class DifferenceExport {

        @Test
        @DisplayName("Export CSV difference avec altitude invalide retourne 400")
        void differenceAltitudeInvalideRetourne400() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/a.nc");
            when(datasetResolver.resolveFilename("mean_MY28_Ls30_60")).thenReturn("/fake/b.nc");
            when(datasetResolver.isIndividualDataset(anyString())).thenReturn(false);

            doThrow(new ValidationException("error.altitude.invalid", 999, 0, 102))
                    .when(validationService).validateAltitude(999);

            mockMvc.perform(get("/api/export/csv/difference")
                            .param("datasetA", "mean_MY28_Ls0_30")
                            .param("datasetB", "mean_MY28_Ls30_60")
                            .param("variable", "TT")
                            .param("time", "0")
                            .param("altitude", "999"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Export CSV difference avec timeB validé (dataset INDIVIDUAL)")
        void differenceTimeBValide() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/a.nc");
            when(datasetResolver.resolveFilename("mean_MY28_Ls30_60")).thenReturn("/fake/b.nc");
            when(datasetResolver.isIndividualDataset(anyString())).thenReturn(false);

            SliceData sliceA = new SliceData(
                    new float[][]{{10f, 20f}},
                    new double[]{0.0}, new double[]{-90, 90});
            SliceData sliceB = new SliceData(
                    new float[][]{{5f, 10f}},
                    new double[]{0.0}, new double[]{-90, 90});

            when(netcdfService.extractSlice2DWithCoords("/fake/a.nc", "TT", 0, 0)).thenReturn(sliceA);
            when(netcdfService.extractSlice2DWithCoords("/fake/b.nc", "TT", 0, 0)).thenReturn(sliceB);

            mockMvc.perform(get("/api/export/csv/difference")
                            .param("datasetA", "mean_MY28_Ls0_30")
                            .param("datasetB", "mean_MY28_Ls30_60")
                            .param("variable", "TT")
                            .param("time", "0")
                            .param("altitude", "0"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type", "text/csv"))
                    .andExpect(content().string(org.hamcrest.Matchers.containsString("latitude,longitude,value_A,value_B,difference")));
        }

        @Test
        @DisplayName("Export CSV difference sans datasetA retourne 400")
        void differenceSansDatasetARetourne400() throws Exception {
            mockMvc.perform(get("/api/export/csv/difference")
                            .param("datasetB", "mean_MY28_Ls30_60"))
                    .andExpect(status().isBadRequest());
        }
    }


    // =========================================================================
    // Slice export
    // =========================================================================

    @Nested
    @DisplayName("Slice CSV export")
    class SliceExport {

        @Test
        @DisplayName("Export CSV slice avec params valides retourne 200 avec en-tête CSV")
        void sliceExportRetourne200() throws Exception {
            when(datasetResolver.resolveFilename("mean_MY28_Ls0_30")).thenReturn("/fake/path.nc");
            when(datasetResolver.isIndividualDataset("mean_MY28_Ls0_30")).thenReturn(false);

            SliceData sliceData = new SliceData(
                    new float[][]{{100f, 200f}, {300f, 400f}},
                    new double[]{-45, 45},
                    new double[]{-90, 90});

            when(netcdfService.extractSlice2DWithCoords("/fake/path.nc", "TT", 0, 0))
                    .thenReturn(sliceData);

            mockMvc.perform(get("/api/export/csv/slice")
                            .param("dataset", "mean_MY28_Ls0_30")
                            .param("variable", "TT")
                            .param("time", "0")
                            .param("altitude", "0"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type", "text/csv"))
                    .andExpect(header().string("Content-Disposition",
                            org.hamcrest.Matchers.containsString("attachment")))
                    .andExpect(content().string(org.hamcrest.Matchers.containsString("latitude,longitude,value")));
        }
    }

    // =========================================================================
    // Hovmoller / ZonalMean / Windrose / Windmap exports
    // =========================================================================

    @Nested
    @DisplayName("Missing parameter validation for new endpoints")
    class NewEndpointsValidation {

        @Test
        @DisplayName("Export CSV hovmoller sans dataset retourne 400")
        void hovmollerSansDatasetRetourne400() throws Exception {
            mockMvc.perform(get("/api/export/csv/hovmoller")
                            .param("variable", "TT")
                            .param("altitude", "0")
                            .param("type", "latitude"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Export CSV zonalmean sans dataset retourne 400")
        void zonalmeanSansDatasetRetourne400() throws Exception {
            mockMvc.perform(get("/api/export/csv/zonalmean")
                            .param("variable", "TT")
                            .param("time", "0"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Export CSV windrose sans dataset retourne 400")
        void windroseSansDatasetRetourne400() throws Exception {
            mockMvc.perform(get("/api/export/csv/windrose")
                            .param("latitude", "0")
                            .param("longitude", "0")
                            .param("altitude", "0"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Export CSV windmap sans dataset retourne 400")
        void windmapSansDatasetRetourne400() throws Exception {
            mockMvc.perform(get("/api/export/csv/windmap")
                            .param("time", "0")
                            .param("altitude", "0"))
                    .andExpect(status().isBadRequest());
        }

    }
}
