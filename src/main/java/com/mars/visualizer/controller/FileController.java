package com.mars.visualizer.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
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
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.StatsCalculator;

import lombok.extern.slf4j.Slf4j;

/**
 * Controller REST principal.
 * Expose les endpoints de consultation du catalogue et d'extraction des donnees
 * depuis les fichiers NetCDF MEAN et INDIVIDUAL.
 *
 * Les datasets INDIVIDUAL sont identifies par le prefixe {@code IND_} dans
 * l'identifiant (ex: {@code IND_MY34_LS5.50}).
 *
 * @author Ludo
 * @version 2.0
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@Slf4j
public class FileController {

	private static final CacheControl DATA_CACHE = CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic();
	private static final CacheControl META_CACHE = CacheControl.maxAge(1,  TimeUnit.HOURS).cachePublic();

	private final NetCDFReaderService      netcdfService;
	private final CatalogService           catalogService;
	private final ValidationService        validationService;
	private final IndividualCatalogService individualCatalogService;
	private final DatasetResolver          datasetResolver;

	public FileController(NetCDFReaderService netcdfService,
						  CatalogService catalogService,
						  ValidationService validationService,
						  IndividualCatalogService individualCatalogService,
						  DatasetResolver datasetResolver) {
		this.netcdfService             = netcdfService;
		this.catalogService            = catalogService;
		this.validationService         = validationService;
		this.individualCatalogService  = individualCatalogService;
		this.datasetResolver           = datasetResolver;
		log.info("FileController initialise");
	}

	// =========================================================================
	// Endpoints catalogue
	// =========================================================================

	/**
	 * GET /api/health
	 */
	@GetMapping("/health")
	public ResponseEntity<Map<String, String>> health() {
		log.debug("Appel endpoint /api/health");

		Map<String, String> response = new HashMap<>();
		response.put("status", "OK");
		response.put("service", "Mars Visualizer API");
		response.put("version", "2.0");

		return ResponseEntity.ok(response);
	}

	/**
	 * Retourne le catalogue des datasets MEAN.
	 * GET /api/catalog
	 */
	@GetMapping("/catalog")
	public ResponseEntity<List<DatasetMetadata>> getCatalog() {
		log.info("GET /api/catalog");
		List<DatasetMetadata> catalog = catalogService.getCatalog();
		log.info("Catalogue retourne : {} datasets", catalog.size());
		return ResponseEntity.ok().cacheControl(META_CACHE).body(catalog);
	}

	/**
	 * Retourne le catalogue des annees martiennes disponibles (fichiers individuels).
	 * GET /api/catalog/individual
	 *
	 * @return liste avec marsYear, lsMin, lsMax (sans les noms de repertoires)
	 */
	@GetMapping("/catalog/individual")
	public ResponseEntity<List<Map<String, Object>>> getIndividualCatalog() {
		log.info("GET /api/catalog/individual");

		List<IndividualYearInfo> years = individualCatalogService.getAvailableYears();

		List<Map<String, Object>> result = years.stream()
				.map(y -> Map.<String, Object>of(
						"marsYear", y.getMarsYear(),
						"lsMin", y.getLsMin(),
						"lsMax", y.getLsMax()))
				.toList();

		log.info("Catalogue INDIVIDUAL retourne : {} annees", result.size());
		return ResponseEntity.ok().cacheControl(META_CACHE).body(result);
	}

	// =========================================================================
	// Endpoints data
	// =========================================================================

	/**
	 * Extrait une slice 2D pour visualisation carte.
	 * GET /api/data/slice
	 */
	@GetMapping("/data/slice")
	public ResponseEntity<SliceResponse> getSlice2D(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam(defaultValue = "0") int altitude) {

		log.info("GET /api/data/slice : dataset={}, variable={}, time={}, altitude={}",
				dataset, variable, time, altitude);

		String filename = datasetResolver.resolveFilename(dataset);
		if (datasetResolver.isIndividualDataset(dataset)) time = 0;
		validationService.validateTimestep(time);
		validationService.validateAltitude(altitude);

		Map<String, Object> sliceData = netcdfService.extractSlice2DWithCoords(
				filename, variable, time, altitude);

		float[][]  data       = (float[][]) sliceData.get("data");
		double[]   latitudes  = (double[]) sliceData.get("latitudes");
		double[]   longitudes = (double[]) sliceData.get("longitudes");
		StatsResult stats     = datasetResolver.toStatsResult(StatsCalculator.calculateStats(data));
		Double altitudeValue  = netcdfService.extractAltitudeValue(filename, variable, altitude);

		SliceResponse response = SliceResponse.builder()
				.dataset(dataset)
				.variable(variable)
				.timeIndex(time)
				.altitudeIndex(altitude)
				.altitudeValue(altitudeValue)
				.actualLs(datasetResolver.getActualLs(dataset, filename))
				.dimensions(Map.of("lat", data.length, "lon", data[0].length))
				.data(data)
				.latitudes(latitudes)
				.longitudes(longitudes)
				.stats(stats)
				.build();

		log.info("Slice 2D retournee : {}x{}", data.length, data[0].length);

		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(response);
	}

	/**
	 * Extrait une serie temporelle en un point.
	 * Non disponible pour les datasets INDIVIDUAL (time = 1).
	 * GET /api/data/timeseries
	 */
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
			throw new ValidationException(
					"La serie temporelle n'est pas disponible pour les fichiers individuels (un seul pas de temps par fichier).");
		}

		String filename = datasetResolver.resolveFilename(dataset);
		validationService.validateLatitude(latitude);
		validationService.validateLongitude(longitude);
		validationService.validateAltitude(altitude);

		List<Float> values = netcdfService.extractTimeSeries(
				filename, variable, latitude, longitude, altitude);

		StatsResult stats = datasetResolver.toStatsResult(StatsCalculator.calculateStats(datasetResolver.toFloatMatrix(values)));
		Double altitudeValue = netcdfService.extractAltitudeValue(filename, variable, altitude);

		TimeSeriesResponse response = TimeSeriesResponse.builder()
				.dataset(dataset)
				.variable(variable)
				.latitude(latitude)
				.longitude(longitude)
				.altitudeIndex(altitude)
				.altitudeValue(altitudeValue)
				.values(values)
				.stats(stats)
				.build();

		log.info("Serie temporelle retournee : {} valeurs", values.size());

		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(response);
	}

	/**
	 * Extrait 48 frames pour animation diurne.
	 * Non disponible pour les datasets INDIVIDUAL (time = 1).
	 * GET /api/data/animation
	 */
	@GetMapping("/data/animation")
	public ResponseEntity<AnimationResponse> getAnimation(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int altitude) {

		log.info("GET /api/data/animation : dataset={}, variable={}, altitude={}",
				dataset, variable, altitude);

		if (datasetResolver.isIndividualDataset(dataset)) {
			throw new ValidationException(
					"L'animation diurne n'est pas disponible pour les fichiers individuels (un seul pas de temps par fichier).");
		}

		String filename = datasetResolver.resolveFilename(dataset);
		validationService.validateAltitude(altitude);

		Map<String, Object> animData = netcdfService.extractAnimationFrames(
				filename, variable, altitude);

		@SuppressWarnings("unchecked")
		List<float[][]> frames    = (List<float[][]>) animData.get("frames");
		double[]        latitudes  = (double[]) animData.get("latitudes");
		double[]        longitudes = (double[]) animData.get("longitudes");
		StatsResult     stats      = datasetResolver.toStatsResult(StatsCalculator.calculateStats(frames.get(0)));
		Double          altitudeValue = netcdfService.extractAltitudeValue(filename, variable, altitude);

		AnimationResponse response = AnimationResponse.builder()
				.dataset(dataset)
				.variable(variable)
				.altitudeIndex(altitude)
				.altitudeValue(altitudeValue)
				.frameCount(frames.size())
				.frames(frames)
				.latitudes(latitudes)
				.longitudes(longitudes)
				.stats(stats)
				.build();

		log.info("Animation retournee : {} frames", frames.size());

		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(response);
	}

	/**
	 * Extrait un profil vertical en un point geographique.
	 * GET /api/data/profile
	 */
	@GetMapping("/data/profile")
	@SuppressWarnings("unchecked")
	public ResponseEntity<ProfileResponse> getProfile(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam double latitude,
			@RequestParam double longitude) {

		log.info("GET /api/data/profile : dataset={}, variable={}, time={}, lat={}, lon={}",
				dataset, variable, time, latitude, longitude);

		String filename = datasetResolver.resolveFilename(dataset);
		if (datasetResolver.isIndividualDataset(dataset)) time = 0;
		validationService.validateTimestep(time);
		validationService.validateLatitude(latitude);
		validationService.validateLongitude(longitude);

		Map<String, Object> profileData = netcdfService.extractVerticalProfile(
				filename, variable, time, latitude, longitude);

		List<Float> values    = (List<Float>) profileData.get("values");
		double[]    altitudes = (double[]) profileData.get("altitudes");
		double actualLat      = (double) profileData.get("actualLat");
		double actualLon      = (double) profileData.get("actualLon");

		StatsResult stats = datasetResolver.toStatsResult(StatsCalculator.calculateStats(datasetResolver.toFloatMatrix(values)));

		ProfileResponse response = ProfileResponse.builder()
				.dataset(dataset)
				.variable(variable)
				.timeIndex(time)
				.latitude(actualLat)
				.longitude(actualLon)
				.actualLs(datasetResolver.getActualLs(dataset, filename))
				.altitudes(altitudes)
				.values(values)
				.stats(stats)
				.build();

		log.info("Profil vertical retourne : {} niveaux", values.size());

		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(response);
	}

	/**
	 * Extrait une coupe verticale meridionale ou zonale.
	 * GET /api/data/crosssection
	 */
	@GetMapping("/data/crosssection")
	public ResponseEntity<CrossSectionResponse> getCrossSection(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam String type,
			@RequestParam double fixedCoordinate) {

		log.info("GET /api/data/crosssection : dataset={}, variable={}, time={}, type={}, fixed={}",
				dataset, variable, time, type, fixedCoordinate);

		String filename = datasetResolver.resolveFilename(dataset);
		if (datasetResolver.isIndividualDataset(dataset)) time = 0;
		validationService.validateTimestep(time);

		if ("meridional".equals(type)) {
			validationService.validateLongitude(fixedCoordinate);
		} else if ("zonal".equals(type)) {
			validationService.validateLatitude(fixedCoordinate);
		}

		Map<String, Object> csData = netcdfService.extractCrossSection(
				filename, variable, time, type, fixedCoordinate);

		float[][]  data             = (float[][]) csData.get("data");
		double[]   altitudes        = (double[]) csData.get("altitudes");
		double[]   horizontalCoords = (double[]) csData.get("horizontalCoords");
		double     fixedValue       = (double) csData.get("fixedValue");

		StatsResult stats = datasetResolver.toStatsResult(StatsCalculator.calculateStats(data));

		CrossSectionResponse response = CrossSectionResponse.builder()
				.dataset(dataset)
				.variable(variable)
				.timeIndex(time)
				.type(type)
				.fixedCoordinate(fixedValue)
				.actualLs(datasetResolver.getActualLs(dataset, filename))
				.altitudes(altitudes)
				.horizontalCoords(horizontalCoords)
				.data(data)
				.stats(stats)
				.build();

		log.info("Coupe verticale {} retournee : {}x{}", type, data.length, data[0].length);

		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(response);
	}

	/**
	 * Retourne le champ de vent (UU, VV) subsamplé pour superposition sur une slice.
	 * Si UU/VV sont absents du fichier, retourne des tableaux vides (pas d'erreur).
	 *
	 * GET /api/data/wind?dataset=...&amp;time=0&amp;altitudeIndex=49
	 */
	@GetMapping("/data/wind")
	public ResponseEntity<Map<String, Object>> getWindField(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam(defaultValue = "49") int altitudeIndex) {

		log.info("GET /api/data/wind : dataset={}, time={}, altitudeIndex={}", dataset, time, altitudeIndex);

		String filename = datasetResolver.resolveFilename(dataset);
		if (datasetResolver.isIndividualDataset(dataset)) time = 0;
		validationService.validateAltitude(altitudeIndex);

		Map<String, Object> windData = netcdfService.extractWindField(filename, time, altitudeIndex);

		log.info("Champ de vent retourne : {} vecteurs", ((double[]) windData.get("lats")).length);

		return ResponseEntity.ok().cacheControl(DATA_CACHE).body(windData);
	}
}
