package com.mars.visualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.response.AnimationResponse;
import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.internal.AnimationData;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.StatsCalculator;

/**
 * Controller REST pour les animations (cycle diurne).
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
public class AnimationController extends AbstractDataController {

    private final NetCDFReaderService netcdfService;

    public AnimationController(NetCDFReaderService netcdfService,
                               ValidationService validationService,
                               DatasetResolver datasetResolver) {
        super(validationService, datasetResolver);
        this.netcdfService = netcdfService;
    }

    @GetMapping("/data/animation")
    public ResponseEntity<AnimationResponse> getAnimation(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int altitude) {

        if (datasetResolver.isIndividualDataset(dataset)) {
            throw new ValidationException("error.individual.animation");
        }

        String filename = datasetResolver.resolveFilename(dataset);
        validationService.validateAltitude(altitude);

        AnimationData animData = netcdfService.extractAnimationFrames(filename, variable, altitude);

        StatsResult stats     = animData.frames().isEmpty() ? null : StatsCalculator.calculateStats(animData.frames().getFirst());
        Double altitudeValue  = netcdfService.extractAltitudeValue(filename, variable, altitude);

        var response = new AnimationResponse(
                dataset, variable, altitude, altitudeValue,
                animData.frames().size(), animData.frames(),
                animData.latitudes(), animData.longitudes(), stats);

        return cachedOk(response);
    }
}
