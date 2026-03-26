package com.mars.visualizer.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.response.SliceResponse;
import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.internal.SliceData;
import com.mars.visualizer.dto.internal.WindFieldData;
import com.mars.visualizer.dto.response.WindFieldResponse;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.StatsCalculator;

/**
 * Controller REST pour les coupes 2D (slice) et le champ de vent.
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
public class SliceController extends AbstractDataController {

    private final NetCDFReaderService netcdfService;

    public SliceController(NetCDFReaderService netcdfService,
                           ValidationService validationService,
                           DatasetResolver datasetResolver) {
        super(validationService, datasetResolver);
        this.netcdfService = netcdfService;
    }

    @GetMapping("/data/slice")
    public ResponseEntity<SliceResponse> getSlice2D(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam(defaultValue = "0") int altitude) {

        var resolved = resolveDataset(dataset, time);
        time = resolved.time();
        validationService.validateTimestep(time);
        validationService.validateAltitude(altitude);

        SliceData sliceData = netcdfService.extractSlice2DWithCoords(
                resolved.filename(), variable, time, altitude);

        StatsResult stats    = StatsCalculator.calculateStats(sliceData.data());
        Double altitudeValue = netcdfService.extractAltitudeValue(resolved.filename(), variable, altitude);

        var response = new SliceResponse(
                dataset, variable, time, altitude, altitudeValue,
                datasetResolver.getActualLs(dataset, resolved.filename()),
                Map.of("lat", sliceData.data().length, "lon", sliceData.data().length > 0 ? sliceData.data()[0].length : 0),
                sliceData.data(), sliceData.latitudes(), sliceData.longitudes(), stats);

        return cachedOk(response);
    }

    @GetMapping("/data/wind")
    public ResponseEntity<WindFieldResponse> getWindField(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam(defaultValue = "49") int altitude) {

        var resolved = resolveDataset(dataset, time);
        time = resolved.time();
        validationService.validateAltitude(altitude);

        WindFieldData windData = netcdfService.extractWindField(resolved.filename(), time, altitude);
        var response = new WindFieldResponse(windData.lats(), windData.lons(), windData.u(), windData.v());

        return cachedOk(response);
    }
}
