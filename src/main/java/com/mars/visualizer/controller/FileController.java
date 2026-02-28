package com.mars.visualizer.controller;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.response.AnimationResponse;
import com.mars.visualizer.dto.response.CrossSectionResponse;
import com.mars.visualizer.dto.response.DatasetMetadata;
import com.mars.visualizer.dto.response.IndividualYearInfo;
import com.mars.visualizer.dto.response.ProfileResponse;
import com.mars.visualizer.dto.response.SliceResponse;
import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.response.TimeSeriesResponse;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.CatalogService;
import com.mars.visualizer.service.IndividualCatalogService;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.NetCDFReaderService.AnimationData;
import com.mars.visualizer.service.NetCDFReaderService.CrossSectionData;
import com.mars.visualizer.service.NetCDFReaderService.ProfileData;
import com.mars.visualizer.service.NetCDFReaderService.SliceData;
import com.mars.visualizer.service.NetCDFReaderService.WindFieldData;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.StatsCalculator;

import lombok.extern.slf4j.Slf4j;

/**
 * Controller REST principal.
 * Expose les endpoints de consultation du catalogue et d'extraction des donnees
 * depuis les fichiers NetCDF MEAN et INDIVIDUAL.
 *
 * @author Ludo
 * @version 3.0
 */
@RestController
@RequestMapping("/api")
@Slf4j
public class FileController extends AbstractDataController {

	private static final CacheControl DATA_CACHE = CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic();
	private static final CacheControl META_CACHE = CacheControl.maxAge(1,  TimeUnit.HOURS).cachePublic();

	private final NetCDFReaderService      netcdfService;
	private final CatalogService           catalogService;
	private final IndividualCatalogService individualCatalogService;

	public FileController(NetCDFReaderService netcdfService,
						  CatalogService catalogService,
						  ValidationService validationService,
						  IndividualCatalogService individualCatalogService,
						  DatasetResolver datasetResolver) {
		super(validationService, datasetResolver);
		this.netcdfService             = netcdfService;
		this.catalogService            = catalogService;
		this.individualCatalogService  = individualCatalogService;
		log.info("FileController initialise");
	}

	// =========================================================================
	// Endpoints catalogue
	// =========================================================================

	@GetMapping("/health")
	public ResponseEntity<Map<String, String>> health() {
		log.debug("Appel endpoint /api/health");
		return ResponseEntity.ok(Map.of(
				"status", "OK",
				"service", "Mars Visualizer API",
				"version", "3.0"));
	}

	@GetMapping("/catalog")
	public ResponseEntity<List<DatasetMetadata>> getCatalog() {
		log.info("GET /api/catalog");
		List<DatasetMetadata> catalog = catalogService.getCatalog();
		log.info("Catalogue retourne : {} datasets", catalog.size());
		return ResponseEntity.ok().cacheControl(META_CACHE).body(catalog);
	}

	@GetMapping("/catalog/individual")
	public ResponseEntity<List<IndividualYearInfo>> getIndividualCatalog() {
		log.info("GET /api/catalog/individual");

		List<IndividualYearInfo> years = individualCatalogService.getAvailableYears();

		log.info("Catalogue INDIVIDUAL retourne : {} annees", years.size());
		return ResponseEntity.ok().cacheControl(META_CACHE).body(years);
	}

	// =========================================================================
	// Endpoints data
	// =========================================================================

	@GetMapping("/data/slice")
	public ResponseEntity<SliceResponse> getSlice2D(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam(defaultValue = "0") int altitude) {

		log.info("GET /api/data/slice : dataset={}, variable={}, time={}, altitude={}",
				dataset, variable, time, altitude);

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

		log.info("Slice 2D retournee : {}x{}", sliceData.data().length, sliceData.data().length > 0 ? sliceData.data()[0].length : 0);
		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(response);
	}

	@GetMapping("/data/timeseries")
	public ResponseEntity<TimeSeriesResponse> getTimeSeries(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam double latitude,
			@RequestParam double longitude,
			@RequestParam(defaultValue = "0") int altitude) {

		log.info("GET /api/data/timeseries : dataset={}, variable={}, lat={}, lon={}, altitude={}",
				dataset, variable, latitude, longitude, altitude);

		if (datasetResolver.isIndividualDataset(dataset)) {
			throw new ValidationException("error.individual.timeseries");
		}

		String filename = datasetResolver.resolveFilename(dataset);
		validationService.validateLatitude(latitude);
		validationService.validateLongitude(longitude);
		validationService.validateAltitude(altitude);

		List<Float> values = netcdfService.extractTimeSeries(
				filename, variable, latitude, longitude, altitude);

		StatsResult stats    = StatsCalculator.calculateStats(values);
		Double altitudeValue = netcdfService.extractAltitudeValue(filename, variable, altitude);

		var response = new TimeSeriesResponse(
				dataset, variable, latitude, longitude, altitude, altitudeValue, values, stats);

		log.info("Serie temporelle retournee : {} valeurs", values.size());
		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(response);
	}

	@GetMapping("/data/animation")
	public ResponseEntity<AnimationResponse> getAnimation(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int altitude) {

		log.info("GET /api/data/animation : dataset={}, variable={}, altitude={}",
				dataset, variable, altitude);

		if (datasetResolver.isIndividualDataset(dataset)) {
			throw new ValidationException("error.individual.animation");
		}

		String filename = datasetResolver.resolveFilename(dataset);
		validationService.validateAltitude(altitude);

		AnimationData animData = netcdfService.extractAnimationFrames(filename, variable, altitude);

		StatsResult stats     = animData.frames().isEmpty() ? null : StatsCalculator.calculateStats(animData.frames().getFirst());
		Double altitudeValue  = netcdfService.extractAltitudeValue(filename, variable, altitude);

		var response = new AnimationResponse(
				dataset, variable, altitude, altitudeValue,
				animData.frames().size(), animData.frames(),
				animData.latitudes(), animData.longitudes(), stats);

		log.info("Animation retournee : {} frames", animData.frames().size());
		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(response);
	}

	@GetMapping("/data/profile")
	public ResponseEntity<ProfileResponse> getProfile(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam double latitude,
			@RequestParam double longitude) {

		log.info("GET /api/data/profile : dataset={}, variable={}, time={}, lat={}, lon={}",
				dataset, variable, time, latitude, longitude);

		var resolved = resolveDataset(dataset, time);
		time = resolved.time();
		validationService.validateTimestep(time);
		validationService.validateLatitude(latitude);
		validationService.validateLongitude(longitude);

		ProfileData profileData = netcdfService.extractVerticalProfile(
				resolved.filename(), variable, time, latitude, longitude);

		StatsResult stats = StatsCalculator.calculateStats(profileData.values());

		var response = new ProfileResponse(
				dataset, variable, time, profileData.actualLat(), profileData.actualLon(),
				datasetResolver.getActualLs(dataset, resolved.filename()),
				profileData.altitudes(), profileData.values(), stats);

		log.info("Profil vertical retourne : {} niveaux", profileData.values().size());
		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(response);
	}

	@GetMapping("/data/crosssection")
	public ResponseEntity<CrossSectionResponse> getCrossSection(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam String type,
			@RequestParam double fixedCoordinate) {

		log.info("GET /api/data/crosssection : dataset={}, variable={}, time={}, type={}, fixed={}",
				dataset, variable, time, type, fixedCoordinate);

		var resolved = resolveDataset(dataset, time);
		time = resolved.time();
		validationService.validateTimestep(time);

		if ("meridional".equals(type)) {
			validationService.validateLongitude(fixedCoordinate);
		} else if ("zonal".equals(type)) {
			validationService.validateLatitude(fixedCoordinate);
		}

		CrossSectionData csData = netcdfService.extractCrossSection(
				resolved.filename(), variable, time, type, fixedCoordinate);

		StatsResult stats = StatsCalculator.calculateStats(csData.data());

		var response = new CrossSectionResponse(
				dataset, variable, time, type, csData.fixedValue(),
				datasetResolver.getActualLs(dataset, resolved.filename()),
				csData.altitudes(), csData.horizontalCoords(), csData.data(), stats);

		log.info("Coupe verticale {} retournee : {}x{}", type, csData.data().length, csData.data().length > 0 ? csData.data()[0].length : 0);
		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(response);
	}

	@GetMapping("/data/wind")
	public ResponseEntity<WindFieldData> getWindField(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam(defaultValue = "49") int altitudeIndex) {

		log.info("GET /api/data/wind : dataset={}, time={}, altitudeIndex={}", dataset, time, altitudeIndex);

		var resolved = resolveDataset(dataset, time);
		time = resolved.time();
		validationService.validateAltitude(altitudeIndex);

		WindFieldData windData = netcdfService.extractWindField(resolved.filename(), time, altitudeIndex);

		log.info("Champ de vent retourne : {} vecteurs", windData.lats().length);
		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(windData);
	}
}
