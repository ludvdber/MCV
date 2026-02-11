package com.mars.visualizer.controller;

import java.util.List;
import java.util.Map;

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
import com.mars.visualizer.service.CatalogService;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;

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

    private final NetCDFReaderService netcdfService;
    private final ValidationService   validationService;
    private final CatalogService      catalogService;

    /**
     * Constructeur avec injection de dépendances.
     *
     * @param netcdfService     service de lecture NetCDF
     * @param validationService service de validation des paramètres
     * @param catalogService    service de gestion du catalogue
     */
    public ExportController(NetCDFReaderService netcdfService,
                            ValidationService validationService,
                            CatalogService catalogService) {
        this.netcdfService     = netcdfService;
        this.validationService = validationService;
        this.catalogService    = catalogService;
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

        String ncFile = resolveFilename(dataset);
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

        String ncFile = resolveFilename(dataset);
        validationService.validateLatitude(latitude);
        validationService.validateLongitude(longitude);
        validationService.validateAltitude(altitude);

        List<Float> values = netcdfService.extractTimeSeries(
                ncFile, variable, latitude, longitude, altitude);

        String csv = buildTimeSeriesCSV(values);

        String filename = String.format("timeseries_%s_%s_lat%s_lon%s_alt%d.csv",
                dataset, variable,
                formatCoord(latitude),
                formatCoord(longitude),
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
        return new ResponseEntity<>(csvContent, headers, HttpStatus.OK);
    }

    /**
     * Vérifie qu'un dataset existe et retourne son nom de fichier complet.
     *
     * @param dataset identifiant du dataset (sans extension)
     * @return nom de fichier avec extension {@code .nc}
     * @throws ValidationException si le dataset est introuvable dans le catalogue
     */
    private String resolveFilename(String dataset) {
        if (!catalogService.datasetExists(dataset)) {
            throw new ValidationException("Dataset introuvable : '" + dataset + "'");
        }
        String filename = catalogService.getFilenameById(dataset);
        if (filename == null) {
            throw new ValidationException("Impossible de trouver le fichier pour dataset : '" + dataset + "'");
        }
        return filename;
    }

    /**
     * Formate une coordonnée décimale pour l'intégrer dans un nom de fichier.
     * Remplace le point par une virgule et supprime le signe moins avec un préfixe.
     * Exemple : {@code -45.5} → {@code m45.5}, {@code 12.0} → {@code 12.0}
     *
     * @param coord coordonnée à formater
     * @return chaîne sûre pour un nom de fichier
     */
    private String formatCoord(double coord) {
        String formatted = String.valueOf(coord).replace('.', 'p');
        return coord < 0 ? "m" + formatted.substring(1) : formatted;
    }
}
