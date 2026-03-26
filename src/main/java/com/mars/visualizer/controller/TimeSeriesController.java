package com.mars.visualizer.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.response.TimeSeriesResponse;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.StatsCalculator;

/**
 * Controller REST pour les series temporelles.
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
public class TimeSeriesController extends AbstractDataController {

    private final NetCDFReaderService netcdfService;

    public TimeSeriesController(NetCDFReaderService netcdfService,
                                ValidationService validationService,
                                DatasetResolver datasetResolver) {
        super(validationService, datasetResolver);
        this.netcdfService = netcdfService;
    }

    @GetMapping("/data/timeseries")
    public ResponseEntity<TimeSeriesResponse> getTimeSeries(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam double latitude,
            @RequestParam double longitude,
            @RequestParam(defaultValue = "0") int altitude) {

        if (datasetResolver.isIndividualDataset(dataset)) {
            throw new ValidationException("error.individual.timeseries");
        }

        String filename = datasetResolver.resolveFilename(dataset);
        validationService.validateLatitude(latitude);
        validationService.validateLongitude(longitude);
        validationService.validateAltitude(altitude);

        List<Float> values = netcdfService.extractTimeSeries(
                filename, variable, latitude, longitude, altitude);

        StatsResult stats    = StatsCalculator.calculateStats(values);
        Double altitudeValue = netcdfService.extractAltitudeValue(filename, variable, altitude);

        var response = new TimeSeriesResponse(
                dataset, variable, latitude, longitude, altitude, altitudeValue, values, stats);

        return cachedOk(response);
    }
}
