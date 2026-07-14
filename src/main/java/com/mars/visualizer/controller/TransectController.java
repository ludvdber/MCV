package com.mars.visualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.internal.TransectData;
import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.response.TransectResponse;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.StatsCalculator;

/**
 * Controller REST pour les transects grand-cercle : coupe verticale le long
 * de la géodésique entre deux points, contrairement à la coupe classique
 * limitée aux méridiens et parallèles.
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
public class TransectController extends AbstractDataController {

    /** Bornes du nombre de points échantillonnés le long du trajet. */
    private static final int POINTS_MIN = 8;
    private static final int POINTS_MAX = 181;

    private final NetCDFReaderService netcdfService;

    public TransectController(NetCDFReaderService netcdfService,
                              ValidationService validationService,
                              DatasetResolver datasetResolver) {
        super(validationService, datasetResolver);
        this.netcdfService = netcdfService;
    }

    @GetMapping("/data/transect")
    public ResponseEntity<TransectResponse> getTransect(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam double lat1,
            @RequestParam double lon1,
            @RequestParam double lat2,
            @RequestParam double lon2,
            @RequestParam(defaultValue = "96") int points) {

        var resolved = resolveDataset(dataset, time);
        time = resolved.time();
        validationService.validateTimestep(time);
        validationService.validateLatitude(lat1);
        validationService.validateLatitude(lat2);
        validationService.validateLongitude(lon1);
        validationService.validateLongitude(lon2);

        int nPoints = Math.max(POINTS_MIN, Math.min(POINTS_MAX, points));

        TransectData trData = netcdfService.extractTransect(
                resolved.filename(), variable, time, lat1, lon1, lat2, lon2, nPoints);

        StatsResult stats = StatsCalculator.calculateStats(trData.data());

        var response = new TransectResponse(
                dataset, variable, time,
                datasetResolver.getActualLs(dataset, resolved.filename()),
                lat1, lon1, lat2, lon2,
                trData.altitudes(), trData.distances(), trData.lats(), trData.lons(),
                trData.data(), stats);

        return cachedOk(response);
    }
}
