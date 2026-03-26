package com.mars.visualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.response.CrossSectionResponse;
import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.internal.CrossSectionData;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.MarsConstants;
import com.mars.visualizer.util.StatsCalculator;

/**
 * Controller REST pour les coupes verticales (cross-section).
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
public class CrossSectionController extends AbstractDataController {

    private final NetCDFReaderService netcdfService;

    public CrossSectionController(NetCDFReaderService netcdfService,
                                  ValidationService validationService,
                                  DatasetResolver datasetResolver) {
        super(validationService, datasetResolver);
        this.netcdfService = netcdfService;
    }

    @GetMapping("/data/crosssection")
    public ResponseEntity<CrossSectionResponse> getCrossSection(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam String type,
            @RequestParam double fixedCoordinate) {

        var resolved = resolveDataset(dataset, time);
        time = resolved.time();
        validationService.validateTimestep(time);

        if (MarsConstants.CROSS_SECTION_MERIDIONAL.equals(type)) {
            validationService.validateLongitude(fixedCoordinate);
        } else if (MarsConstants.CROSS_SECTION_ZONAL.equals(type)) {
            validationService.validateLatitude(fixedCoordinate);
        }

        CrossSectionData csData = netcdfService.extractCrossSection(
                resolved.filename(), variable, time, type, fixedCoordinate);

        StatsResult stats = StatsCalculator.calculateStats(csData.data());

        var response = new CrossSectionResponse(
                dataset, variable, time, type, csData.fixedValue(),
                datasetResolver.getActualLs(dataset, resolved.filename()),
                csData.altitudes(), csData.horizontalCoords(), csData.data(), stats);

        return cachedOk(response);
    }
}
