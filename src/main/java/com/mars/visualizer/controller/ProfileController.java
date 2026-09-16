package com.mars.visualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.response.ProfileResponse;
import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.response.TemporalProfileResponse;
import com.mars.visualizer.dto.internal.ProfileData;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.MarsConstants;
import com.mars.visualizer.util.StatsCalculator;

/**
 * Controller REST pour les profils verticaux et temporels.
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
public class ProfileController extends AbstractDataController {

    private final NetCDFReaderService netcdfService;

    public ProfileController(NetCDFReaderService netcdfService,
                             ValidationService validationService,
                             DatasetResolver datasetResolver) {
        super(validationService, datasetResolver);
        this.netcdfService = netcdfService;
    }

    @GetMapping("/data/profile")
    public ResponseEntity<ProfileResponse> getProfile(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam double latitude,
            @RequestParam double longitude) {

        var resolved = resolveDataset(dataset, time);
        time = resolved.time();
        validationService.validateTimestep(time);
        validationService.validateLatitude(latitude);
        validationService.validateLongitude(longitude);

        ProfileData profileData = netcdfService.extractVerticalProfile(
                resolved.filename(), variable, time, latitude, longitude);

        StatsResult stats = StatsCalculator.calculateStats(profileData.values());

        var response = new ProfileResponse(
                dataset, variable, time, profileData.actualLat(), profileData.actualLon(),
                datasetResolver.getActualLs(dataset, resolved.filename()),
                profileData.altitudes(), profileData.values(), stats);

        return cachedOk(response);
    }

    @GetMapping("/data/temporal-profile")
    public ResponseEntity<TemporalProfileResponse> getTemporalProfile(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam double latitude,
            @RequestParam double longitude) {

        requireMeanDataset(dataset);

        var resolved = resolveDataset(dataset, 0);
        validationService.validateLatitude(latitude);
        validationService.validateLongitude(longitude);

        var tpData = netcdfService.extractTemporalProfile(
                resolved.filename(), variable, latitude, longitude);

        int nTime = tpData.data()[0].length;
        double[] times = MarsConstants.generateTimeHours(nTime);
        StatsResult stats = StatsCalculator.calculateStats(tpData.data());

        var response = new TemporalProfileResponse(
                dataset, variable,
                tpData.actualLat(), tpData.actualLon(),
                datasetResolver.getActualLs(dataset, resolved.filename()),
                tpData.altitudes(), times, tpData.data(), stats);

        return cachedOk(response);
    }

    /**
     * Un profil temporel est une grille altitude x temps. Un fichier INDIVIDUAL
     * ne porte qu'un seul pas de temps, donc la grille se reduit a UNE colonne :
     * un graphe qui a l'air d'un diagnostic et ne dit rien du cycle diurne.
     *
     * <p>Les cinq autres vues qui ont besoin des 48 pas refusent deja
     * ({@code timeseries}, {@code animation}, {@code hovmoller},
     * {@code windrose}, {@code tides}), et le frontend classe deja le profil
     * temporel parmi elles : {@code MEAN_ONLY_TYPES} le masque dans la console
     * Explorer pour un jeu individuel. Seule l'API le contredisait encore, en
     * repondant 200. Mesure sur le site en ligne avant correction : une reponse
     * complete avec {@code times} d'un seul element.
     */
    private void requireMeanDataset(String dataset) {
        if (datasetResolver.isIndividualDataset(dataset)) {
            throw new ValidationException("error.individual.temporalprofile");
        }
    }
}
