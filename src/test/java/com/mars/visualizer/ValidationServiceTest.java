package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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

    @Nested
    @DisplayName("validateVariable")
    class ValidateVariable {

        @Test
        @DisplayName("Variable valide — aucune exception")
        void variableValideAucuneException() {
            assertThatCode(() -> validationService.validateVariable("TT", List.of("TT", "UU", "VV", "P0")))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Variable invalide — ValidationException levée")
        void variableInvalideLeveException() {
            assertThatThrownBy(() -> validationService.validateVariable("INVALID", List.of("TT", "UU")))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("Variable vide — ValidationException levée")
        void variableVideLeveException() {
            assertThatThrownBy(() -> validationService.validateVariable("", List.of("TT")))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("Variable null — ValidationException levée")
        void variableNullLeveException() {
            assertThatThrownBy(() -> validationService.validateVariable(null, List.of("TT")))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("Variable blanche — ValidationException levée")
        void variableBlancheLeveException() {
            assertThatThrownBy(() -> validationService.validateVariable("   ", List.of("TT")))
                    .isInstanceOf(ValidationException.class);
        }
    }

    // =========================================================================
    // validateAltitude
    // =========================================================================

    @Nested
    @DisplayName("validateAltitude")
    class ValidateAltitude {

        @Test
        @DisplayName("Altitude 0 — valide (sommet)")
        void altitude0Valide() {
            assertThatCode(() -> validationService.validateAltitude(0))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Altitude 102 — valide (max)")
        void altitude102Valide() {
            assertThatCode(() -> validationService.validateAltitude(102))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Altitude 50 — valide (milieu)")
        void altitude50Valide() {
            assertThatCode(() -> validationService.validateAltitude(50))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Altitude -1 — ValidationException levée")
        void altitudeMoins1LeveException() {
            assertThatThrownBy(() -> validationService.validateAltitude(-1))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("Altitude 103 — ValidationException levée")
        void altitude103LeveException() {
            assertThatThrownBy(() -> validationService.validateAltitude(103))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("Altitude 104 — ValidationException levée")
        void altitude104LeveException() {
            assertThatThrownBy(() -> validationService.validateAltitude(104))
                    .isInstanceOf(ValidationException.class);
        }
    }

    // =========================================================================
    // validateTimestep
    // =========================================================================

    @Nested
    @DisplayName("validateTimestep")
    class ValidateTimestep {

        @Test
        @DisplayName("Timestep 0 — valide (premier index)")
        void timestep0Valide() {
            assertThatCode(() -> validationService.validateTimestep(0))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Timestep 47 — valide (dernier index MEAN)")
        void timestep47Valide() {
            assertThatCode(() -> validationService.validateTimestep(47))
                    .doesNotThrowAnyException();
        }

        @ParameterizedTest
        @ValueSource(ints = {-1, -100, 48, 49, 100, Integer.MAX_VALUE})
        @DisplayName("Timesteps hors bornes — ValidationException levée")
        void timestepHorsBornesLeveException(int timestep) {
            assertThatThrownBy(() -> validationService.validateTimestep(timestep))
                    .isInstanceOf(ValidationException.class);
        }
    }

    // =========================================================================
    // validateLatitude
    // =========================================================================

    @Nested
    @DisplayName("validateLatitude")
    class ValidateLatitude {

        @Test
        @DisplayName("Latitude 0.0 — valide (équateur)")
        void latitude0Valide() {
            assertThatCode(() -> validationService.validateLatitude(0.0))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Latitude -90.0 — valide (pôle sud)")
        void latitudeMoins90Valide() {
            assertThatCode(() -> validationService.validateLatitude(-90.0))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Latitude 90.0 — valide (pôle nord)")
        void latitude90Valide() {
            assertThatCode(() -> validationService.validateLatitude(90.0))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Latitude 91.0 — ValidationException levée")
        void latitude91LeveException() {
            assertThatThrownBy(() -> validationService.validateLatitude(91.0))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("Latitude -91.0 — ValidationException levée")
        void latitudeMoins91LeveException() {
            assertThatThrownBy(() -> validationService.validateLatitude(-91.0))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("Latitude NaN — ValidationException levée (pas un index 0 silencieux)")
        void latitudeNaNLeveException() {
            assertThatThrownBy(() -> validationService.validateLatitude(Double.NaN))
                    .isInstanceOf(ValidationException.class);
        }
    }

    // =========================================================================
    // validateLongitude
    // =========================================================================

    @Nested
    @DisplayName("validateLongitude")
    class ValidateLongitude {

        @Test
        @DisplayName("Longitude 0.0 — valide (méridien)")
        void longitude0Valide() {
            assertThatCode(() -> validationService.validateLongitude(0.0))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Longitude -180.0 — valide (antiméridien)")
        void longitudeMoins180Valide() {
            assertThatCode(() -> validationService.validateLongitude(-180.0))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Longitude 180.0 — valide (antiméridien)")
        void longitude180Valide() {
            assertThatCode(() -> validationService.validateLongitude(180.0))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Longitude 181.0 — ValidationException levée")
        void longitude181LeveException() {
            assertThatThrownBy(() -> validationService.validateLongitude(181.0))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("Longitude -181.0 — ValidationException levée")
        void longitudeMoins181LeveException() {
            assertThatThrownBy(() -> validationService.validateLongitude(-181.0))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("Longitude NaN — ValidationException levée (pas un index 0 silencieux)")
        void longitudeNaNLeveException() {
            assertThatThrownBy(() -> validationService.validateLongitude(Double.NaN))
                    .isInstanceOf(ValidationException.class);
        }
    }
}
