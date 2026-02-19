package com.mars.visualizer.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

import lombok.extern.slf4j.Slf4j;

/**
 * Controller REST pour l'export de données (UC4).
 * Permet d'exporter les résultats de visualisation en format CSV.
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api/export")
@CrossOrigin(origins = "*")
@Slf4j
public class ExportController {

    private final NetCDFReaderService      netcdfService;
    private final ValidationService        validationService;
    private final DatasetResolver          datasetResolver;

    public ExportController(NetCDFReaderService netcdfService,
                            ValidationService validationService,
                            DatasetResolver datasetResolver) {
        this.netcdfService             = netcdfService;
        this.validationService         = validationService;
        this.datasetResolver           = datasetResolver;
        log.info("ExportController initialisé");
    }

    /**
     * Exporte une slice 2D en format CSV.
     * Format : latitude, longitude, valeur
     * GET /api/export/csv/slice?dataset=...&amp;variable=TT&amp;time=0&amp;altitude=0
     *
     * @param dataset  identifiant du dataset
     * @param variable nom de la variable
     * @param time     index temporel (0-47)
     * @param altitude index d'altitude (0-102)
     * @return fichier CSV avec Content-Type text/csv
     */
    @GetMapping("/csv/slice")
    public ResponseEntity<String> exportSliceCSV(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam(defaultValue = "0") int altitude) {

        log.info("GET /api/export/csv/slice : dataset={}, variable={}, time={}, altitude={}",
                dataset, variable, time, altitude);

        String ncFile = datasetResolver.resolveFilename(dataset);
        if (datasetResolver.isIndividualDataset(dataset)) time = 0;
        validationService.validateTimestep(time);
        validationService.validateAltitude(altitude);

        Map<String, Object> sliceData = netcdfService.extractSlice2DWithCoords(
                ncFile, variable, time, altitude);

        float[][]  data       = (float[][]) sliceData.get("data");
        double[]   latitudes  = (double[]) sliceData.get("latitudes");
        double[]   longitudes = (double[]) sliceData.get("longitudes");

        String csv = buildSliceCSV(data, latitudes, longitudes);

        String filename = String.format("slice_%s_%s_t%d_alt%d.csv",
                dataset, variable, time, altitude);

        log.info("Export slice CSV généré : {} lignes, fichier={}", data.length * data[0].length, filename);

        return csvResponse(csv, filename);
    }

    /**
     * Exporte une série temporelle en format CSV.
     * Format : timestep, value
     *
     * GET /api/export/csv/timeseries?dataset=...&amp;variable=TT&amp;latitude=0&amp;longitude=0&amp;altitude=0
     *
     * @param dataset   identifiant du dataset
     * @param variable  nom de la variable
     * @param latitude  latitude du point
     * @param longitude longitude du point
     * @param altitude  index d'altitude
     * @return fichier CSV avec Content-Type text/csv
     */
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
            throw new ValidationException(
                    "L'export de serie temporelle n'est pas disponible pour les fichiers individuels (un seul pas de temps par fichier).");
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

    /**
     * Construit le contenu CSV d'une slice 2D.
     * Format de chaque ligne : {@code latitude,longitude,value}.
     *
     * @param data      grille 2D des valeurs [lat][lon]
     * @param latitudes tableau des latitudes (peut être null)
     * @param longitudes tableau des longitudes (peut être null)
     * @return contenu CSV complet
     */
    private String buildSliceCSV(float[][] data, double[] latitudes, double[] longitudes) {
        StringBuilder sb = new StringBuilder("latitude,longitude,value\n");

        for (int i = 0; i < data.length; i++) {
            double lat = (latitudes  != null && i < latitudes.length)  ? latitudes[i]  : i;
            for (int j = 0; j < data[i].length; j++) {
                double lon = (longitudes != null && j < longitudes.length) ? longitudes[j] : j;
                sb.append(lat).append(',').append(lon).append(',').append(data[i][j]).append('\n');
            }
        }

        return sb.toString();
    }

    /**
     * Construit le contenu CSV d'une série temporelle.
     * Format de chaque ligne : {@code timestep,value}.
     *
     * @param values liste des 48 valeurs
     * @return contenu CSV complet
     */
    private String buildTimeSeriesCSV(List<Float> values) {
        StringBuilder sb = new StringBuilder("timestep,value\n");

        for (int t = 0; t < values.size(); t++) {
            sb.append(t).append(',').append(values.get(t)).append('\n');
        }

        return sb.toString();
    }

    /**
     * Exporte un profil vertical en format CSV.
     * Format : altitude_km,value
     *
     * GET /api/export/csv/profile?dataset=...&amp;variable=TT&amp;time=0&amp;latitude=0&amp;longitude=0
     */
    @GetMapping("/csv/profile")
    @SuppressWarnings("unchecked")
    public ResponseEntity<String> exportProfileCSV(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam double latitude,
            @RequestParam double longitude) {

        log.info("GET /api/export/csv/profile : dataset={}, variable={}, time={}, lat={}, lon={}",
                dataset, variable, time, latitude, longitude);

        String ncFile = datasetResolver.resolveFilename(dataset);
        if (datasetResolver.isIndividualDataset(dataset)) time = 0;
        validationService.validateTimestep(time);
        validationService.validateLatitude(latitude);
        validationService.validateLongitude(longitude);

        Map<String, Object> profileData = netcdfService.extractVerticalProfile(
                ncFile, variable, time, latitude, longitude);

        List<Float> values    = (List<Float>) profileData.get("values");
        double[]    altitudes = (double[]) profileData.get("altitudes");

        StringBuilder sb = new StringBuilder("altitude_km,value\n");
        for (int i = 0; i < values.size(); i++) {
            double alt = (altitudes != null && i < altitudes.length) ? altitudes[i] : i;
            sb.append(alt).append(',').append(values.get(i)).append('\n');
        }

        String filename = String.format("profile_%s_%s_t%d_lat%s_lon%s.csv",
                dataset, variable, time, datasetResolver.formatCoord(latitude), datasetResolver.formatCoord(longitude));

        log.info("Export profil CSV généré : {} niveaux, fichier={}", values.size(), filename);

        return csvResponse(sb.toString(), filename);
    }

    /**
     * Exporte une coupe verticale en format CSV.
     * Format : altitude_km,horizontal_coord,value
     *
     * GET /api/export/csv/crosssection?dataset=...&amp;variable=TT&amp;time=0&amp;type=meridional&amp;fixedCoordinate=0
     */
    @GetMapping("/csv/crosssection")
    public ResponseEntity<String> exportCrossSectionCSV(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable,
            @RequestParam(defaultValue = "0") int time,
            @RequestParam String type,
            @RequestParam double fixedCoordinate) {

        log.info("GET /api/export/csv/crosssection : dataset={}, variable={}, time={}, type={}, fixed={}",
                dataset, variable, time, type, fixedCoordinate);

        String ncFile = datasetResolver.resolveFilename(dataset);
        if (datasetResolver.isIndividualDataset(dataset)) time = 0;
        validationService.validateTimestep(time);

        Map<String, Object> csData = netcdfService.extractCrossSection(
                ncFile, variable, time, type, fixedCoordinate);

        float[][]  data         = (float[][]) csData.get("data");
        double[]   altitudes    = (double[]) csData.get("altitudes");
        double[]   horizCoords  = (double[]) csData.get("horizontalCoords");

        String horizLabel = "meridional".equals(type) ? "latitude" : "longitude";
        StringBuilder sb = new StringBuilder("altitude_km,").append(horizLabel).append(",value\n");

        for (int a = 0; a < data.length; a++) {
            double alt = (altitudes != null && a < altitudes.length) ? altitudes[a] : a;
            for (int h = 0; h < data[a].length; h++) {
                double coord = (horizCoords != null && h < horizCoords.length) ? horizCoords[h] : h;
                sb.append(alt).append(',').append(coord).append(',').append(data[a][h]).append('\n');
            }
        }

        String filename = String.format("crosssection_%s_%s_%s_t%d_fixed%s.csv",
                dataset, variable, type, time, datasetResolver.formatCoord(fixedCoordinate));

        log.info("Export coupe verticale CSV généré : {}x{}, fichier={}", data.length, data[0].length, filename);

        return csvResponse(sb.toString(), filename);
    }

    // Méthodes utilitaires

    /**
     * Construit une réponse HTTP avec Content-Type {@code text/csv}
     * et en-tête {@code Content-Disposition} pour téléchargement.
     *
     * @param csvContent contenu du fichier CSV
     * @param filename   nom du fichier proposé au téléchargement
     * @return ResponseEntity prête à être retournée
     */
    private ResponseEntity<String> csvResponse(String csvContent, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.setCacheControl(CacheControl.noStore().getHeaderValue());
        return new ResponseEntity<>(csvContent, headers, HttpStatus.OK);
    }
}
