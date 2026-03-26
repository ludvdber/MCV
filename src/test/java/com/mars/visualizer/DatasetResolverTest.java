package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.CatalogService;
import com.mars.visualizer.service.IndividualCatalogService;
import com.mars.visualizer.util.DatasetResolver;

@ExtendWith(MockitoExtension.class)
class DatasetResolverTest {

    @Mock
    private CatalogService catalogService;

    @Mock
    private IndividualCatalogService individualCatalogService;

    private DatasetResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new DatasetResolver(catalogService, individualCatalogService);
    }

    // =========================================================================
    // isIndividualDataset
    // =========================================================================

    @Nested
    @DisplayName("isIndividualDataset")
    class IsIndividual {

        @Test
        @DisplayName("Dataset IND_ est individual")
        void datasetIndEstIndividual() {
            assertThat(resolver.isIndividualDataset("IND_MY34_LS5.00")).isTrue();
        }

        @Test
        @DisplayName("Dataset mean_ n'est pas individual")
        void datasetMeanNestPasIndividual() {
            assertThat(resolver.isIndividualDataset("mean_MY28_Ls0_30")).isFalse();
        }

        @Test
        @DisplayName("Dataset null n'est pas individual")
        void datasetNullNestPasIndividual() {
            assertThat(resolver.isIndividualDataset(null)).isFalse();
        }

        @Test
        @DisplayName("Dataset vide n'est pas individual")
        void datasetVideNestPasIndividual() {
            assertThat(resolver.isIndividualDataset("")).isFalse();
        }
    }

    // =========================================================================
    // resolveFilename
    // =========================================================================

    @Nested
    @DisplayName("resolveFilename")
    class ResolveFilename {

        @Test
        @DisplayName("Dataset MEAN existant retourne le filename")
        void datasetMeanExistantRetourneFilename() {
            when(catalogService.getFilenameById("mean_MY28_Ls0_30"))
                    .thenReturn(Optional.of("mean_MY28_Ls0_30.nc"));

            String filename = resolver.resolveFilename("mean_MY28_Ls0_30");
            assertThat(filename).isEqualTo("mean_MY28_Ls0_30.nc");
        }

        @Test
        @DisplayName("Dataset MEAN inexistant lève ValidationException")
        void datasetMeanInexistantLeveException() {
            when(catalogService.getFilenameById("nonexistent"))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> resolver.resolveFilename("nonexistent"))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("Dataset IND_ avec format invalide lève ValidationException")
        void datasetIndFormatInvalideLeveException() {
            assertThatThrownBy(() -> resolver.resolveFilename("IND_INVALID"))
                    .isInstanceOf(ValidationException.class);
        }
    }

    // =========================================================================
    // formatCoord
    // =========================================================================

    @Nested
    @DisplayName("formatCoord")
    class FormatCoord {

        @Test
        @DisplayName("Coordonnée positive : 45.0 → 45p0")
        void coordonneePositive() {
            assertThat(resolver.formatCoord(45.0)).isEqualTo("45p0");
        }

        @Test
        @DisplayName("Coordonnée négative : -90.5 → m90p5")
        void coordonneeNegative() {
            assertThat(resolver.formatCoord(-90.5)).isEqualTo("m90p5");
        }

        @Test
        @DisplayName("Coordonnée zéro : 0.0 → 0p0")
        void coordonneeZero() {
            assertThat(resolver.formatCoord(0.0)).isEqualTo("0p0");
        }
    }

    // =========================================================================
    // getActualLs
    // =========================================================================

    @Nested
    @DisplayName("getActualLs")
    class GetActualLs {

        @Test
        @DisplayName("Dataset MEAN retourne null")
        void datasetMeanRetourneNull() {
            assertThat(resolver.getActualLs("mean_MY28_Ls0_30", "/fake/path.nc")).isNull();
        }
    }
}
