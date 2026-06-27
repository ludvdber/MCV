package com.mars.visualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.response.WindRoseResponse;
import com.mars.visualizer.dto.internal.WindRoseData;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

/**
 * Controller REST pour la rose des vents et la carte de vent.
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
public class WindController extends AbstractDataController {

    private final NetCDFReaderService netcdfService;

    public WindController(NetCDFReaderService netcdfService,
                          ValidationService validationService,
                          DatasetResolver datasetResolver) {
        super(validationService, datasetResolver);
        this.netcdfService = netcdfService;
    }

    @GetMapping("/data/windrose")
    public ResponseEntity<WindRoseResponse> getWindRose(
            @RequestParam String dataset,
            @RequestParam double latitude,
            @RequestParam double longitude,
            @RequestParam(defaultValue = "49") int altitude) {

        if (datasetResolver.isIndividualDataset(dataset)) {
            throw new ValidationException("error.individual.windrose");
        }

        String filename = datasetResolver.resolveFilename(dataset);
        validationService.validateLatitude(latitude);
        validationService.validateLongitude(longitude);
        validationService.validateAltitude(altitude);

        WindRoseData wrData = netcdfService.extractWindRose(filename, latitude, longitude, altitude);
        Double altitudeValue = netcdfService.extractAltitudeValue(filename, "UU", altitude);

        var response = new WindRoseResponse(
                dataset, latitude, longitude, altitude, altitudeValue,
                wrData.uu(), wrData.vv(), wrData.actualLat(), wrData.actualLon());

        return cachedOk(response);
    }
}
