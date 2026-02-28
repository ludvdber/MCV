package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;

import java.nio.file.Path;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.when;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.service.IndividualCatalogService;

import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class IndividualCatalogServiceTest {

    @Mock
    private DataPathConfig pathConfig;

    @Mock
    private ObjectMapper objectMapper;

    private IndividualCatalogService service;

    @BeforeEach
    void setUp() {
        service = new IndividualCatalogService(pathConfig, objectMapper);
    }

    @Test
    @DisplayName("getActualLs depuis nom de fichier ls000_2300 retourne 0.23")
    void actualLsDepuisLs000_2300() {
        Path fakePath = Path.of("hl-b274_000000p_ls000_2300.nc");
        double ls = service.getActualLs(fakePath);

        assertThat(ls)
                .as("Ls de ls000_2300 doit être 0.23")
                .isCloseTo(0.23, within(0.001));
    }

    @Test
    @DisplayName("getActualLs depuis nom de fichier ls090_0000 retourne 90.0")
    void actualLsDepuisLs090_0000() {
        Path fakePath = Path.of("hl-b274_000000p_ls090_0000.nc");
        double ls = service.getActualLs(fakePath);

        assertThat(ls)
                .as("Ls de ls090_0000 doit être 90.0")
                .isCloseTo(90.0, within(0.001));
    }

    @Test
    @DisplayName("Catalogue vide si dossier individual est vide")
    void catalogueVideSiDossierVide(@TempDir Path tempDir) {
        when(pathConfig.getIndividualPath()).thenReturn(tempDir);

        service.initCatalog();

        assertThat(service.getAvailableYears())
                .as("Le catalogue doit être vide si le dossier individual est vide")
                .isEmpty();
    }
}
