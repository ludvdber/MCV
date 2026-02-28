package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.ValidationService;

@ExtendWith(MockitoExtension.class)
class ValidationServiceTest {

    private ValidationService validationService;

    @BeforeEach
    void setUp() {
        validationService = new ValidationService();
    }

    // =========================================================================
    // validateVariable
    // =========================================================================

    @Test
    @DisplayName("Variable valide — aucune exception")
    void variableValideAucuneException() {
        assertThatCode(() -> validationService.validateVariable("TT", List.of("TT", "UU", "VV", "P0")))
                .as("Une variable présente dans la liste ne doit pas lever d'exception")
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Variable invalide — ValidationException levée")
    void variableInvalideLeveException() {
        assertThatThrownBy(() -> validationService.validateVariable("INVALID", List.of("TT", "UU")))
                .as("Une variable absente doit lever ValidationException")
                .isInstanceOf(ValidationException.class);
    }

    @Test
    @DisplayName("Variable vide — ValidationException levée")
    void variableVideLeveException() {
        assertThatThrownBy(() -> validationService.validateVariable("", List.of("TT")))
                .as("Une variable vide doit lever ValidationException")
                .isInstanceOf(ValidationException.class);
    }

    // =========================================================================
    // validateAltitude
    // =========================================================================

    @Test
    @DisplayName("Altitude 0 — valide")
    void altitude0Valide() {
        assertThatCode(() -> validationService.validateAltitude(0))
                .as("L'altitude 0 (sommet) doit être valide")
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Altitude -1 — ValidationException levée")
    void altitudeMoins1LeveException() {
        assertThatThrownBy(() -> validationService.validateAltitude(-1))
                .as("Une altitude négative doit lever ValidationException")
                .isInstanceOf(ValidationException.class);
    }

    @Test
    @DisplayName("Altitude 104 — ValidationException levée")
    void altitude104LeveException() {
        assertThatThrownBy(() -> validationService.validateAltitude(104))
                .as("Une altitude > 102 doit lever ValidationException")
                .isInstanceOf(ValidationException.class);
    }

    // =========================================================================
    // validateTimestep
    // =========================================================================

    @Test
    @DisplayName("Timestep 0 — valide")
    void timestep0Valide() {
        assertThatCode(() -> validationService.validateTimestep(0))
                .as("Le timestep 0 doit être valide")
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Timestep 47 — valide (dernier index MEAN)")
    void timestep47Valide() {
        assertThatCode(() -> validationService.validateTimestep(47))
                .as("Le timestep 47 (dernier index) doit être valide")
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Timestep 48 — ValidationException levée")
    void timestep48LeveException() {
        assertThatThrownBy(() -> validationService.validateTimestep(48))
                .as("Le timestep 48 (hors borne) doit lever ValidationException")
                .isInstanceOf(ValidationException.class);
    }

    // =========================================================================
    // validateLatitude
    // =========================================================================

    @Test
    @DisplayName("Latitude 0.0 — valide")
    void latitude0Valide() {
        assertThatCode(() -> validationService.validateLatitude(0.0))
                .as("La latitude 0.0 (équateur) doit être valide")
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Latitude 91.0 — ValidationException levée")
    void latitude91LeveException() {
        assertThatThrownBy(() -> validationService.validateLatitude(91.0))
                .as("Une latitude > 90 doit lever ValidationException")
                .isInstanceOf(ValidationException.class);
    }
}
