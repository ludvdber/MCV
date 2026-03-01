package com.mars.visualizer.controller;

import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.NetCDFReaderService.CrossSectionData;
import com.mars.visualizer.service.NetCDFReaderService.ProfileData;
import com.mars.visualizer.service.NetCDFReaderService.SliceData;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.MarsConstants;

import lombok.extern.slf4j.Slf4j;

/**
 * Controller REST pour l'export de données (UC4).
 * Permet d'exporter les résultats de visualisation en format CSV.
 *
 * @author Ludo
 * @version 2.0
 */
@RestController
@RequestMapping("/api/export")
@Slf4j
public class ExportController extends AbstractDataController {

    private static final MediaType TEXT_CSV = MediaType.parseMediaType("text/csv");

    private final NetCDFReaderService netcdfService;

    public ExportController(NetCDFReaderService netcdfService,
                            ValidationService validationService,
                            DatasetResolver datasetResolver) {
        super(validationService, datasetResolver);
        this.netcdfService = netcdfService;
        log.info("ExportController initialisé");
    }

    @GetMapping("/csv/slice")
    public ResponseEntity<String> exportSliceCSV(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam(defaultValue = "0") int altitude) {

        log.info("GET /api/export/csv/slice : dataset={}, variable={}, time={}, altitude={}",
                dataset, variable, time, altitude);

        var resolved = resolveDataset(dataset, time);
        time = resolved.time();
        validationService.validateTimestep(time);
        validationService.validateAltitude(altitude);

        SliceData sliceData = netcdfService.extractSlice2DWithCoords(
                resolved.filename(), variable, time, altitude);

        String csv = buildSliceCSV(sliceData.data(), sliceData.latitudes(), sliceData.longitudes());

        String filename = String.format("slice_%s_%s_t%d_alt%d.csv",
                dataset, variable, time, altitude);

        log.info("Export slice CSV généré : {} lignes, fichier={}",
                sliceData.data().length * sliceData.data()[0].length, filename);

        return csvResponse(csv, filename);
    }

    @GetMapping("/csv/timeseries")
    public ResponseEntity<String> exportTimeSeriesCSV(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam double latitude,
            @RequestParam double longitude,
            @RequestParam(defaultValue = "0") int altitude) {

        log.info("GET /api/export/csv/timeseries : dataset={}, variable={}, lat={}, lon={}, altitude={}",
                dataset, variable, latitude, longitude, altitude);

        if (datasetResolver.isIndividualDataset(dataset)) {
            throw new ValidationException("error.individual.export.timeseries");
        }

        String ncFile = datasetResolver.resolveFilename(dataset);
        validationService.validateLatitude(latitude);
        validationService.validateLongitude(longitude);
        validationService.validateAltitude(altitude);

        List<Float> values = netcdfService.extractTimeSeries(
                ncFile, variable, latitude, longitude, altitude);

        String csv = buildTimeSeriesCSV(values);

        String filename = String.format("timeseries_%s_%s_lat%s_lon%s_alt%d.csv",
                dataset, variable,
                datasetResolver.formatCoord(latitude),
                datasetResolver.formatCoord(longitude),
                altitude);

        log.info("Export série temporelle CSV généré : {} valeurs, fichier={}", values.size(), filename);
        return csvResponse(csv, filename);
    }

    @GetMapping("/csv/profile")
    public ResponseEntity<String> exportProfileCSV(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam double latitude,
            @RequestParam double longitude) {

        log.info("GET /api/export/csv/profile : dataset={}, variable={}, time={}, lat={}, lon={}",
                dataset, variable, time, latitude, longitude);

        var resolved = resolveDataset(dataset, time);
        time = resolved.time();
        validationService.validateTimestep(time);
        validationService.validateLatitude(latitude);
        validationService.validateLongitude(longitude);

        ProfileData profileData = netcdfService.extractVerticalProfile(
                resolved.filename(), variable, time, latitude, longitude);

        StringBuilder sb = new StringBuilder("altitude_km,value\n");
        for (int i = 0; i < profileData.values().size(); i++) {
            double alt = (profileData.altitudes() != null && i < profileData.altitudes().length)
                    ? profileData.altitudes()[i] : i;
            sb.append(alt).append(',').append(profileData.values().get(i)).append('\n');
        }

        String filename = String.format("profile_%s_%s_t%d_lat%s_lon%s.csv",
                dataset, variable, time,
                datasetResolver.formatCoord(latitude),
                datasetResolver.formatCoord(longitude));

        log.info("Export profil CSV généré : {} niveaux, fichier={}", profileData.values().size(), filename);
        return csvResponse(sb.toString(), filename);
    }

    @GetMapping("/csv/crosssection")
    public ResponseEntity<String> exportCrossSectionCSV(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam String type,
            @RequestParam double fixedCoordinate) {

        log.info("GET /api/export/csv/crosssection : dataset={}, variable={}, time={}, type={}, fixed={}",
                dataset, variable, time, type, fixedCoordinate);

        var resolved = resolveDataset(dataset, time);
        time = resolved.time();
        validationService.validateTimestep(time);

        if (!MarsConstants.CROSS_SECTION_MERIDIONAL.equals(type) && !MarsConstants.CROSS_SECTION_ZONAL.equals(type)) {
            throw new ValidationException("error.netcdf.crosssection.type", type);
        }

        if (MarsConstants.CROSS_SECTION_MERIDIONAL.equals(type)) {
            validationService.validateLongitude(fixedCoordinate);
        } else {
            validationService.validateLatitude(fixedCoordinate);
        }

        CrossSectionData csData = netcdfService.extractCrossSection(
                resolved.filename(), variable, time, type, fixedCoordinate);

        String horizLabel = MarsConstants.CROSS_SECTION_MERIDIONAL.equals(type) ? "latitude" : "longitude";
        StringBuilder sb = new StringBuilder("altitude_km,").append(horizLabel).append(",value\n");

        for (int a = 0; a < csData.data().length; a++) {
            double alt = (csData.altitudes() != null && a < csData.altitudes().length)
                    ? csData.altitudes()[a] : a;
            for (int h = 0; h < csData.data()[a].length; h++) {
                double coord = (csData.horizontalCoords() != null && h < csData.horizontalCoords().length)
                        ? csData.horizontalCoords()[h] : h;
                sb.append(alt).append(',').append(coord).append(',').append(csData.data()[a][h]).append('\n');
            }
        }

        String filename = String.format("crosssection_%s_%s_%s_t%d_fixed%s.csv",
                dataset, variable, type, time, datasetResolver.formatCoord(fixedCoordinate));

        log.info("Export coupe verticale CSV généré : {}x{}, fichier={}",
                csData.data().length, csData.data().length > 0 ? csData.data()[0].length : 0, filename);
        return csvResponse(sb.toString(), filename);
    }

    // Méthodes utilitaires

    private String buildSliceCSV(float[][] data, double[] latitudes, double[] longitudes) {
        StringBuilder sb = new StringBuilder("latitude,longitude,value\n");
        for (int i = 0; i < data.length; i++) {
            double lat = (latitudes != null && i < latitudes.length) ? latitudes[i] : i;
            for (int j = 0; j < data[i].length; j++) {
                double lon = (longitudes != null && j < longitudes.length) ? longitudes[j] : j;
                sb.append(lat).append(',').append(lon).append(',').append(data[i][j]).append('\n');
            }
        }
        return sb.toString();
    }

    private String buildTimeSeriesCSV(List<Float> values) {
        StringBuilder sb = new StringBuilder("timestep,value\n");
        for (int t = 0; t < values.size(); t++) {
            sb.append(t).append(',').append(values.get(t)).append('\n');
        }
        return sb.toString();
    }

    private ResponseEntity<String> csvResponse(String csvContent, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(TEXT_CSV);
        headers.setContentDispositionFormData("attachment", filename);
        headers.setCacheControl(CacheControl.noStore().getHeaderValue());
        return new ResponseEntity<>(csvContent, headers, HttpStatus.OK);
    }
}
