package com.mars.visualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.response.ZonalMeanResponse;
import com.mars.visualizer.dto.internal.ZonalMeanData;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.StatsCalculator;

/**
 * Controller REST pour les moyennes zonales.
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
public class ZonalMeanController extends AbstractDataController {

    private final NetCDFReaderService netcdfService;

    public ZonalMeanController(NetCDFReaderService netcdfService,
                               ValidationService validationService,
                               DatasetResolver datasetResolver) {
        super(validationService, datasetResolver);
        this.netcdfService = netcdfService;
    }

    @GetMapping("/data/zonalmean")
    public ResponseEntity<ZonalMeanResponse> getZonalMean(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time) {

        var resolved = resolveDataset(dataset, time);
        time = resolved.time();
        validationService.validateTimestep(time);

        ZonalMeanData zmData = netcdfService.extractZonalMean(resolved.filename(), variable, time);

        StatsResult stats = StatsCalculator.calculateStats(zmData.data());

        var response = new ZonalMeanResponse(
                dataset, variable, time,
                datasetResolver.getActualLs(dataset, resolved.filename()),
                zmData.latitudes(), zmData.altitudes(), zmData.data(), stats);

        return cachedOk(response);
    }
}
