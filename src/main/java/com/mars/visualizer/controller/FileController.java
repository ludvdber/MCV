package com.mars.visualizer.controller;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.mars.visualizer.dto.response.AnimationResponse;
import com.mars.visualizer.dto.response.DatasetMetadata;
import com.mars.visualizer.dto.response.SliceResponse;
import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.response.TimeSeriesResponse;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.CatalogService;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.StatsCalculator;
import lombok.extern.slf4j.Slf4j;

/**
 * Controller REST principal.
 * Expose les endpoints de consultation du catalogue et d'extraction des données
 * depuis les fichiers NetCDF MEAN.
 * 
 * Les exceptions métier ({@link ValidationException},
 * {@link com.mars.visualizer.exception.NetCDFException}) sont déléguées au
 * {@link com.mars.visualizer.exception.GlobalExceptionHandler}.
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@Slf4j
public class FileController {

	private final NetCDFReaderService netcdfService;
	private final CatalogService      catalogService;
	private final ValidationService   validationService;

	/**
	 * Constructeur avec injection de dépendances.
	 *
	 * @param netcdfService     service de lecture NetCDF
	 * @param catalogService    service de gestion du catalogue
	 * @param validationService service de validation des paramètres
	 */
	public FileController(NetCDFReaderService netcdfService,
						  CatalogService catalogService,
						  ValidationService validationService) {
		this.netcdfService     = netcdfService;
		this.catalogService    = catalogService;
		this.validationService = validationService;
		log.info("FileController initialisé");
	}

	/**
	 * Endpoint de test pour vérifier que l'API fonctionne.
	 * 
	 * GET /api/health
	 *
	 * @return message de statut avec nom et version du service
	 */
	@GetMapping("/health")
	public ResponseEntity<Map<String, String>> health() {
		log.debug("Appel endpoint /api/health");

		Map<String, String> response = new HashMap<>();
		response.put("status", "OK");
		response.put("service", "Mars Visualizer API");
		response.put("version", "1.0");

		return ResponseEntity.ok(response);
	}

	/**
	 * Retourne le catalogue complet des datasets disponibles.
	 * Endpoint principal pour UC1 (Explorer catalogue).
	 * 
	 * GET /api/catalog
	 *
	 * @return liste des métadonnées de tous les datasets MEAN
	 */
	@GetMapping("/catalog")
	public ResponseEntity<List<DatasetMetadata>> getCatalog() {
		log.info("GET /api/catalog");

		List<DatasetMetadata> catalog = catalogService.getCatalog();

		log.info("Catalogue retourné : {} datasets", catalog.size());

		return ResponseEntity.ok(catalog);
	}

	/**
	 * Extrait une slice 2D pour visualisation carte (UC2).
	 * 
	 * GET /api/data/slice?dataset=...&amp;variable=TT&amp;time=0&amp;altitude=0
	 *
	 * @param dataset  identifiant du dataset
	 * @param variable nom de la variable
	 * @param time     index temporel (0-47)
	 * @param altitude index d'altitude (0-102)
	 * @return {@link SliceResponse} avec données 2D + coordonnées + stats
	 */
	@GetMapping("/data/slice")
	public ResponseEntity<SliceResponse> getSlice2D(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam(defaultValue = "0") int altitude) {

		log.info("GET /api/data/slice : dataset={}, variable={}, time={}, altitude={}",
				dataset, variable, time, altitude);

		String filename = resolveFilename(dataset);
		validationService.validateTimestep(time);
		validationService.validateAltitude(altitude);

		Map<String, Object> sliceData = netcdfService.extractSlice2DWithCoords(
				filename, variable, time, altitude);

		float[][]  data       = (float[][]) sliceData.get("data");
		double[]   latitudes  = (double[]) sliceData.get("latitudes");
		double[]   longitudes = (double[]) sliceData.get("longitudes");
		StatsResult stats     = toStatsResult(StatsCalculator.calculateStats(data));

		SliceResponse response = SliceResponse.builder()
				.dataset(dataset)
				.variable(variable)
				.timeIndex(time)
				.altitudeIndex(altitude)
				.dimensions(Map.of("lat", data.length, "lon", data[0].length))
				.data(data)
				.latitudes(latitudes)
				.longitudes(longitudes)
				.stats(stats)
				.build();

		log.info("Slice 2D retournée : {}x{}", data.length, data[0].length);

		return ResponseEntity.ok(response);
	}

	/**
	 * Extrait une série temporelle en un point (UC3).
	 * Retourne 48 valeurs (cycle diurne complet).
	 * 
	 * GET /api/data/timeseries?dataset=...&amp;variable=TT&amp;latitude=0&amp;longitude=0&amp;altitude=0
	 *
	 * @param dataset   identifiant du dataset
	 * @param variable  nom de la variable
	 * @param latitude  latitude du point (-90 à 90)
	 * @param longitude longitude du point (-180 à 180)
	 * @param altitude  index d'altitude (0-102)
	 * @return {@link TimeSeriesResponse} avec 48 valeurs + stats
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

		String filename = resolveFilename(dataset);
		validationService.validateLatitude(latitude);
		validationService.validateLongitude(longitude);
		validationService.validateAltitude(altitude);

		List<Float> values = netcdfService.extractTimeSeries(
				filename, variable, latitude, longitude, altitude);

		StatsResult stats = toStatsResult(StatsCalculator.calculateStats(toFloatMatrix(values)));

		TimeSeriesResponse response = TimeSeriesResponse.builder()
				.dataset(dataset)
				.variable(variable)
				.latitude(latitude)
				.longitude(longitude)
				.altitudeIndex(altitude)
				.values(values)
				.stats(stats)
				.build();

		log.info("Série temporelle retournée : {} valeurs", values.size());

		return ResponseEntity.ok(response);
	}


	/**
	 * Extrait 48 frames pour animation diurne (UC5).
	 * Chaque frame est une slice 2D [lat][lon].
	 * 
	 * GET /api/data/animation?dataset=...&amp;variable=TT&amp;altitude=0
	 *
	 * @param dataset  identifiant du dataset
	 * @param variable nom de la variable
	 * @param altitude index d'altitude (0-102)
	 * @return {@link AnimationResponse} avec 48 frames + coordonnées + stats
	 */
	@GetMapping("/data/animation")
	public ResponseEntity<AnimationResponse> getAnimation(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int altitude) {

		log.info("GET /api/data/animation : dataset={}, variable={}, altitude={}",
				dataset, variable, altitude);

		String filename = resolveFilename(dataset);
		validationService.validateAltitude(altitude);

		List<float[][]> frames = netcdfService.extractAnimationFrames(
				filename, variable, altitude);

		// Récupérer lat/lon depuis la frame 0 via extractSlice2DWithCoords
		Map<String, Object> frame0Data = netcdfService.extractSlice2DWithCoords(
				filename, variable, 0, altitude);

		double[]    latitudes  = (double[]) frame0Data.get("latitudes");
		double[]    longitudes = (double[]) frame0Data.get("longitudes");
		StatsResult stats      = toStatsResult(StatsCalculator.calculateStats(frames.get(0)));

		AnimationResponse response = AnimationResponse.builder()
				.dataset(dataset)
				.variable(variable)
				.altitudeIndex(altitude)
				.frameCount(frames.size())
				.frames(frames)
				.latitudes(latitudes)
				.longitudes(longitudes)
				.stats(stats)
				.build();

		log.info("Animation retournée : {} frames", frames.size());

		return ResponseEntity.ok(response);
	}

	// Méthodes utilitaires
	
	/**
	 * Vérifie qu'un dataset existe et retourne son nom de fichier complet.
	 * Combine la vérification d'existence et la résolution du filename en une seule étape.
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
	 * Convertit la map de statistiques brutes en {@link StatsResult} DTO.
	 *
	 * @param statsMap map issue de {@link NetCDFReaderService#calculateStats(float[][])}
	 * @return DTO de statistiques
	 */
	private StatsResult toStatsResult(Map<String, Double> statsMap) {
		return StatsResult.builder()
				.min(statsMap.get("min"))
				.max(statsMap.get("max"))
				.mean(statsMap.get("mean"))
				.stddev(statsMap.get("stddev"))
				.build();
	}

	/**
	 * Convertit une liste de flottants en matrice {@code float[1][n]}
	 * pour être compatible avec {@link NetCDFReaderService#calculateStats(float[][])}.
	 *
	 * @param values liste de valeurs
	 * @return matrice ligne contenant les mêmes valeurs
	 */
	private float[][] toFloatMatrix(List<Float> values) {
		float[][] matrix = new float[1][values.size()];
		for (int i = 0; i < values.size(); i++) {
			Float v = values.get(i);
			matrix[0][i] = (v != null) ? v : Float.NaN;
		}
		return matrix;
	}
}
