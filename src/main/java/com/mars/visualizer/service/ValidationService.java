package com.mars.visualizer.service;
import java.util.List;
import org.springframework.stereotype.Service;
import com.mars.visualizer.exception.ValidationException;
import lombok.extern.slf4j.Slf4j;

/**
 * Service de validation des paramètres utilisateur.
 * Lève ValidationException si un paramètre est invalide.
 *
 * @author Ludo
 * @version 2.0
 */
@Service
@Slf4j
public class ValidationService {

    private static final int TIMESTEP_MIN = 0;
    private static final int TIMESTEP_MAX = 47;
    private static final int ALTITUDE_MIN = 0;
    private static final int ALTITUDE_MAX = 102;

    /**
     * Valide l'index temporel (0-47).
     * Les fichiers MEAN contiennent 48 timesteps (cycle diurne complet).
     *
     * @param timestep index temporel à valider
     * @throws ValidationException si timestep &lt; 0 ou &gt;= 48
     */
    public void validateTimestep(int timestep) {
        log.debug("Validation timestep : {}", timestep);

        if (timestep < TIMESTEP_MIN || timestep > TIMESTEP_MAX) {
            throw new ValidationException("error.timestep.invalid",
                    timestep, TIMESTEP_MIN, TIMESTEP_MAX);
        }
    }

    /**
     * Valide l'index d'altitude (0-102).
     * Les fichiers MEAN contiennent 103 niveaux verticaux.
     *
     * @param altitude index altitude à valider
     * @throws ValidationException si altitude &lt; 0 ou &gt;= 103
     */
    public void validateAltitude(int altitude) {
        log.debug("Validation altitude : {}", altitude);

        if (altitude < ALTITUDE_MIN || altitude > ALTITUDE_MAX) {
            throw new ValidationException("error.altitude.invalid",
                    altitude, ALTITUDE_MIN, ALTITUDE_MAX);
        }
    }

    /**
     * Vérifie que la variable demandée existe dans le fichier.
     *
     * @param variable      nom de la variable
     * @param availableVars liste des variables disponibles
     * @throws ValidationException si variable non trouvée
     */
    public void validateVariable(String variable, List<String> availableVars) {
        log.debug("Validation variable '{}' dans : {}", variable, availableVars);

        if (variable == null || variable.isBlank()) {
            throw new ValidationException("error.variable.empty");
        }

        if (!availableVars.contains(variable)) {
            throw new ValidationException("error.variable.not.found",
                    variable, availableVars);
        }
    }

    /**
     * Valide une latitude (-90 à 90 degrés).
     *
     * @param lat latitude à valider
     * @throws ValidationException si hors bornes
     */
    public void validateLatitude(double lat) {
        log.debug("Validation latitude : {}", lat);

        if (lat < -90.0 || lat > 90.0) {
            throw new ValidationException("error.latitude.invalid", lat);
        }
    }

    /**
     * Valide une longitude (-180 à 180 degrés).
     *
     * @param lon longitude à valider
     * @throws ValidationException si hors bornes
     */
    public void validateLongitude(double lon) {
        log.debug("Validation longitude : {}", lon);

        if (lon < -180.0 || lon > 180.0) {
            throw new ValidationException("error.longitude.invalid", lon);
        }
    }
}
