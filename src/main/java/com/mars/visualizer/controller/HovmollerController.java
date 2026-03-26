package com.mars.visualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.response.HovmollerResponse;
import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.internal.HovmollerData;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.MarsConstants;
import com.mars.visualizer.util.StatsCalculator;

/**
 * Controller REST pour les diagrammes de Hovmoller.
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
public class HovmollerController extends AbstractDataController {

    private final NetCDFReaderService netcdfService;

    public HovmollerController(NetCDFReaderService netcdfService,
                               ValidationService validationService,
                               DatasetResolver datasetResolver) {
        super(validationService, datasetResolver);
        this.netcdfService = netcdfService;
    }

    @GetMapping("/data/hovmoller")
    public ResponseEntity<HovmollerResponse> getHovmoller(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int altitude,
            @RequestParam(defaultValue = "latitude") String type) {

        if (datasetResolver.isIndividualDataset(dataset)) {
            throw new ValidationException("error.individual.hovmoller");
        }

        if (!MarsConstants.HOVMOLLER_LATITUDE.equals(type) && !MarsConstants.HOVMOLLER_LONGITUDE.equals(type)) {
            throw new ValidationException("error.netcdf.hovmoller.type", type);
        }

        String filename = datasetResolver.resolveFilename(dataset);
        validationService.validateAltitude(altitude);

        HovmollerData hovData = netcdfService.extractHovmoller(filename, variable, altitude, type);

        StatsResult stats     = StatsCalculator.calculateStats(hovData.data());
        Double altitudeValue  = netcdfService.extractAltitudeValue(filename, variable, altitude);

        var response = new HovmollerResponse(
                dataset, variable, altitude, altitudeValue, type,
                hovData.times(), hovData.spatialCoords(), hovData.data(), stats);

        return cachedOk(response);
    }
}
