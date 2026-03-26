package com.mars.visualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.response.DifferenceResponse;
import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.internal.SliceData;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.StatsCalculator;

/**
 * Controller REST pour le calcul de differences entre deux datasets.
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
public class DifferenceController extends AbstractDataController {

    private final NetCDFReaderService netcdfService;

    public DifferenceController(NetCDFReaderService netcdfService,
                                ValidationService validationService,
                                DatasetResolver datasetResolver) {
        super(validationService, datasetResolver);
        this.netcdfService = netcdfService;
    }

    @GetMapping("/data/difference")
    public ResponseEntity<DifferenceResponse> getDifference(
            @RequestParam String datasetA,
            @RequestParam String datasetB,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam(defaultValue = "0") int altitude) {

        var resolvedA = resolveDataset(datasetA, time);
        var resolvedB = resolveDataset(datasetB, time);
        int timeA = resolvedA.time();
        int timeB = resolvedB.time();
        validationService.validateTimestep(timeA);
        validationService.validateTimestep(timeB);
        validationService.validateAltitude(altitude);

        SliceData sliceA = netcdfService.extractSlice2DWithCoords(resolvedA.filename(), variable, timeA, altitude);
        SliceData sliceB = netcdfService.extractSlice2DWithCoords(resolvedB.filename(), variable, timeB, altitude);

        float[][] diff = StatsCalculator.computeGridDifference(sliceA.data(), sliceB.data());
        StatsResult stats = StatsCalculator.calculateStats(diff);
        Double altitudeValue = netcdfService.extractAltitudeValue(resolvedA.filename(), variable, altitude);

        var response = new DifferenceResponse(
                datasetA, datasetB, variable, time, altitude, altitudeValue,
                diff, sliceA.latitudes(), sliceA.longitudes(), stats);

        return cachedOk(response);
    }
}
