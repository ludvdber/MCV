package com.mars.visualizer.controller;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.service.NetCDFReaderService;

import lombok.extern.slf4j.Slf4j;

/**
 * Controller REST pour l'accès aux fichiers NetCDF. Expose les endpoints de
 * l'API pour lister et consulter les fichiers.
 */
@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "*")
@Slf4j
public class FileController {

	private final NetCDFReaderService netcdfService;

	/**
	 * Constructeur avec injection de dépendances.
	 * 
	 * @param netcdfService service de lecture NetCDF
	 */
	public FileController(NetCDFReaderService netcdfService) {
		this.netcdfService = netcdfService;
		log.info("FileController initialisé");
	}

	/**
	 * Endpoint de test pour vérifier que l'API fonctionne.
	 * 
	 * GET /api/files/health
	 * 
	 * @return message de statut
	 */
	@GetMapping("/health")
	public ResponseEntity<Map<String, String>> health() {
		log.debug("Appel endpoint /api/files/health");

		Map<String, String> response = new HashMap<>();
		response.put("status", "OK");
		response.put("service", "Mars Visualizer API");
		response.put("version", "1.0");

		return ResponseEntity.ok(response);
	}

	/**
	 * Liste tous les fichiers MEAN disponibles.
	 * 
	 * GET /api/files/mean
	 * 
	 * @return liste des noms de fichiers MEAN
	 */
	@GetMapping("/mean")
	public ResponseEntity<?> listMeanFiles() {
		log.info("Requête GET /api/files/mean");

		try {
			List<String> files = netcdfService.listMeanFiles();

			Map<String, Object> response = new HashMap<>();
			response.put("count", files.size());
			response.put("files", files);

			log.info("Fichiers MEAN retournés : {} fichiers", files.size());

			return ResponseEntity.ok(response);

		} catch (IOException e) {
			log.error("Erreur lecture répertoire MEAN", e);

			Map<String, String> error = new HashMap<>();
			error.put("error", "Erreur lecture répertoire MEAN");
			error.put("message", e.getMessage());

			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
		}
	}

	/**
	 * Récupère les métadonnées d'un fichier MEAN spécifique.
	 * 
	 * GET /api/files/mean/{filename}
	 * 
	 * @param filename nom du fichier MEAN
	 * @return métadonnées du fichier
	 */
	@GetMapping("/mean/{filename}")
	public ResponseEntity<?> getMeanFileInfo(@PathVariable("filename") String filename) {
		log.info("Requête GET /api/files/mean/{}", filename);

		// Vérifier que le fichier existe
		if (!netcdfService.meanFileExists(filename)) {
			log.warn("Fichier MEAN introuvable : {}", filename);

			Map<String, String> error = new HashMap<>();
			error.put("error", "Fichier introuvable");
			error.put("filename", filename);

			return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
		}

		try {
			String info = netcdfService.getMeanFileInfo(filename);

			Map<String, Object> response = new HashMap<>();
			response.put("filename", filename);
			response.put("info", info);

			log.info("Métadonnées retournées pour : {}", filename);

			return ResponseEntity.ok(response);

		} catch (IOException e) {
			log.error("Erreur lecture fichier MEAN : {}", filename, e);

			Map<String, String> error = new HashMap<>();
			error.put("error", "Erreur lecture fichier");
			error.put("filename", filename);
			error.put("message", e.getMessage());

			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
		}
	}

	/**
	 * Compte le nombre de fichiers MEAN disponibles.
	 * 
	 * GET /api/files/mean/count
	 * 
	 * @return nombre de fichiers
	 */
	@GetMapping("/mean/count")
	public ResponseEntity<?> countMeanFiles() {
		log.info("Requête GET /api/files/mean/count");

		try {
			int count = netcdfService.listMeanFiles().size();

			Map<String, Integer> response = new HashMap<>();
			response.put("count", count);

			log.info("Nombre de fichiers MEAN : {}", count);

			return ResponseEntity.ok(response);

		} catch (IOException e) {
			log.error("Erreur comptage fichiers MEAN", e);

			Map<String, String> error = new HashMap<>();
			error.put("error", "Erreur comptage fichiers");
			error.put("message", e.getMessage());

			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
		}
	}

	/**
	 * Liste les variables disponibles dans un fichier MEAN.
	 * 
	 * GET /api/files/mean/{filename}/variables
	 * 
	 * @param filename nom du fichier MEAN
	 * @return liste des variables
	 */
	@GetMapping("/mean/{filename}/variables")
	public ResponseEntity<?> listVariables(@PathVariable("filename") String filename) {
		log.info("Requête GET /api/files/mean/{}/variables", filename);

		if (!netcdfService.meanFileExists(filename)) {
			Map<String, String> error = new HashMap<>();
			error.put("error", "Fichier introuvable");
			error.put("filename", filename);
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
		}

		try {
			List<String> variables = netcdfService.listVariables(filename);

			Map<String, Object> response = new HashMap<>();
			response.put("filename", filename);
			response.put("count", variables.size());
			response.put("variables", variables);

			return ResponseEntity.ok(response);

		} catch (IOException e) {
			log.error("Erreur liste variables : {}", filename, e);

			Map<String, String> error = new HashMap<>();
			error.put("error", "Erreur lecture variables");
			error.put("message", e.getMessage());

			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
		}
	}

	/**
	 * Extrait une slice 2D d'une variable pour visualisation.
	 * 
	 * GET /api/files/mean/{filename}/slice?variable=TT&time=0&altitude=0
	 * 
	 * @param filename      nom du fichier MEAN
	 * @param variable      nom de la variable (ex: TT)
	 * @param timeIndex     index temporel (0-47)
	 * @param altitudeIndex index altitude (0-102)
	 * @return données 2D en JSON
	 */
	@GetMapping("/mean/{filename}/slice")
	public ResponseEntity<?> getSlice2D(@PathVariable("filename") String filename,
			@RequestParam(name = "variable", defaultValue = "TT") String variable,
			@RequestParam(name = "time", defaultValue = "0") int timeIndex,
			@RequestParam(name = "altitude", defaultValue = "0") int altitudeIndex) {

		log.info("Requête GET /api/files/mean/{}/slice?variable={}&time={}&altitude={}", filename, variable, timeIndex,
				altitudeIndex);

		if (!netcdfService.meanFileExists(filename)) {
			Map<String, String> error = new HashMap<>();
			error.put("error", "Fichier introuvable");
			error.put("filename", filename);
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
		}

		try {
			// Utiliser la version avec coordonnées
			Map<String, Object> sliceData = netcdfService.extractSlice2DWithCoords(filename, variable, timeIndex,
					altitudeIndex);

			float[][] data = (float[][]) sliceData.get("data");

			Map<String, Object> response = new HashMap<>();
			response.put("filename", filename);
			response.put("variable", variable);
			response.put("timeIndex", timeIndex);
			response.put("altitudeIndex", altitudeIndex);
			response.put("dimensions", Map.of("lat", data.length, "lon", data[0].length));
			response.put("data", data);
			response.put("latitudes", sliceData.get("latitudes"));
			response.put("longitudes", sliceData.get("longitudes"));

			log.info("Slice 2D retournée : {}x{}", data.length, data[0].length);

			return ResponseEntity.ok(response);

		} catch (IOException e) {
			log.error("Erreur extraction slice 2D : {}", filename, e);

			Map<String, String> error = new HashMap<>();
			error.put("error", "Erreur extraction données");
			error.put("message", e.getMessage());

			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
		}
	}
}