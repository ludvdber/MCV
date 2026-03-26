package com.mars.visualizer.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.response.AltitudesResponse;
import com.mars.visualizer.dto.response.DatasetMetadata;
import com.mars.visualizer.dto.response.HealthCheckResponse;
import com.mars.visualizer.dto.response.IndividualYearInfo;
import com.mars.visualizer.service.CatalogService;
import com.mars.visualizer.service.IndividualCatalogService;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

import lombok.extern.slf4j.Slf4j;

/**
 * Controller REST pour le catalogue et les metadonnees.
 * Expose les endpoints de sante, catalogue MEAN/INDIVIDUAL et altitudes.
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
@Slf4j
public class CatalogController extends AbstractDataController {

    private final NetCDFReaderService      netcdfService;
    private final CatalogService           catalogService;
    private final IndividualCatalogService individualCatalogService;
    private final String                   appVersion;

    public CatalogController(NetCDFReaderService netcdfService,
                             CatalogService catalogService,
                             ValidationService validationService,
                             IndividualCatalogService individualCatalogService,
                             DatasetResolver datasetResolver,
                             @Value("${app.version:3.0}") String appVersion) {
        super(validationService, datasetResolver);
        this.netcdfService            = netcdfService;
        this.catalogService           = catalogService;
        this.individualCatalogService = individualCatalogService;
        this.appVersion               = appVersion;
        log.info("CatalogController initialise (v{})", appVersion);
    }

    @GetMapping("/health")
    public ResponseEntity<HealthCheckResponse> health() {
        log.debug("Appel endpoint /api/health");
        return ResponseEntity.ok(new HealthCheckResponse("OK", "Mars Visualizer API", appVersion));
    }

    @GetMapping("/catalog")
    public ResponseEntity<List<DatasetMetadata>> getCatalog() {
        log.info("GET /api/catalog");
        List<DatasetMetadata> catalog = catalogService.getCatalog();
        log.info("Catalogue retourne : {} datasets", catalog.size());
        return metaOk(catalog);
    }

    @GetMapping("/catalog/individual")
    public ResponseEntity<List<IndividualYearInfo>> getIndividualCatalog() {
        log.info("GET /api/catalog/individual");
        List<IndividualYearInfo> years = individualCatalogService.getAvailableYears();
        log.info("Catalogue INDIVIDUAL retourne : {} annees", years.size());
        return metaOk(years);
    }

    @GetMapping("/data/altitudes")
    public ResponseEntity<AltitudesResponse> getAltitudes(
            @RequestParam String dataset,
            @RequestParam(defaultValue = "TT") String variable) {

        log.info("GET /api/data/altitudes : dataset={}, variable={}", dataset, variable);

        String filename = datasetResolver.resolveFilename(dataset);
        double[] altitudes = netcdfService.extractAltitudeArray(filename, variable);

        var response = (altitudes == null)
                ? new AltitudesResponse(true, new double[0])
                : new AltitudesResponse(false, altitudes);

        return cachedOk(response);
    }
}
