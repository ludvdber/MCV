package com.mars.visualizer.service;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.mars.visualizer.config.DataPathConfig;

import lombok.extern.slf4j.Slf4j;
import ucar.nc2.NetcdfFile;
import ucar.nc2.NetcdfFiles;

/**
 * Service de lecture des fichiers NetCDF. Gère l'accès aux fichiers MEAN.
 */
@Service
@Slf4j
public class NetCDFReaderService {

	private final DataPathConfig pathConfig;

	/**
	 * Constructeur avec injection de dépendances.
	 * 
	 * @param pathConfig configuration des chemins NetCDF
	 */
	public NetCDFReaderService(DataPathConfig pathConfig) {
		this.pathConfig = pathConfig;
		log.info("NetCDFReaderService initialisé");
	}

	/**
	 * Liste tous les fichiers MEAN disponibles dans le répertoire.
	 * 
	 * @return liste des noms de fichiers MEAN trouvés
	 * @throws IOException si erreur lecture répertoire
	 */
	public List<String> listMeanFiles() throws IOException {
		log.debug("Lecture du répertoire MEAN : {}", pathConfig.getMeanPath());

		List<String> meanFiles = new ArrayList<>();
		Path meanDir = pathConfig.getMeanPath();

		// Parcourir le répertoire et filtrer les fichiers .nc
		try (DirectoryStream<Path> stream = Files.newDirectoryStream(meanDir, "*.nc")) {
			for (Path entry : stream) {
				if (Files.isRegularFile(entry)) {
					meanFiles.add(entry.getFileName().toString());
				}
			}
		}

		// Trier les fichiers par nom (ordre Ls)
		Collections.sort(meanFiles);

		log.info("Fichiers MEAN trouvés : {} fichiers", meanFiles.size());
		log.debug("Fichiers : {}", meanFiles);

		return meanFiles;
	}

	/**
	 * Ouvre un fichier MEAN et retourne l'objet NetcdfFile. doit fermer le fichier
	 * après utilisation.
	 * 
	 * @param filename nom du fichier MEAN à ouvrir
	 * @return objet NetcdfFile ouvert
	 * @throws IOException si erreur ouverture fichier
	 */
	public NetcdfFile openMeanFile(String filename) throws IOException {
		Path filePath = pathConfig.getMeanPath().resolve(filename);

		if (!Files.exists(filePath)) {
			String errorMsg = "Fichier MEAN introuvable : " + filename;
			log.error(errorMsg);
			throw new IOException(errorMsg);
		}

		log.debug("Ouverture fichier NetCDF : {}", filePath);

		// Ouvrir le fichier avec NetcdfFiles
		NetcdfFile ncfile = NetcdfFiles.open(filePath.toString());

		log.info("Fichier NetCDF ouvert : {} (taille: {} octets)", filename, Files.size(filePath));

		return ncfile;
	}

	/**
	 * Lit les métadonnées d'un fichier MEAN sans charger toutes les données. Utile
	 * pour afficher les informations disponibles du fichier.
	 * 
	 * @param filename nom du fichier MEAN
	 * @return informations sur le fichier
	 * @throws IOException si erreur lecture fichier
	 */
	public String getMeanFileInfo(String filename) throws IOException {
		try (NetcdfFile ncfile = openMeanFile(filename)) {
			StringBuilder info = new StringBuilder();

			info.append("Fichier : ").append(filename).append("\n");
			info.append("Format : ").append(ncfile.getFileTypeDescription()).append("\n");
			info.append("Dimensions : ").append(ncfile.getRootGroup().getDimensions()).append("\n");
			info.append("Variables globales : ").append(ncfile.getVariables().size()).append("\n");

			log.debug("Métadonnées extraites pour : {}", filename);

			return info.toString();
		}
	}

	/**
	 * Vérifie si un fichier MEAN existe.
	 * 
	 * @param filename nom du fichier à vérifier
	 * @return true si le fichier existe
	 */
	public boolean meanFileExists(String filename) {
		Path filePath = pathConfig.getMeanPath().resolve(filename);
		boolean exists = Files.exists(filePath);

		log.debug("Vérification existence fichier {} : {}", filename, exists);

		return exists;
	}

	/**
	 * Extrait une slice 2D d'une variable à une altitude et un temps donnés.
	 * 
	 * @param filename      nom du fichier MEAN
	 * @param variableName  nom de la variable (ex: "TT" pour température)
	 * @param timeIndex     index temporel (0-47)
	 * @param altitudeIndex index altitude (0-102 pour altitudeT)
	 * @return tableau 2D [lat][lon] des valeurs
	 * @throws IOException si erreur lecture
	 */
	public float[][] extractSlice2D(String filename, String variableName, int timeIndex, int altitudeIndex)
			throws IOException {

		log.info("Extraction slice 2D : fichier={}, variable={}, time={}, altitude={}", filename, variableName,
				timeIndex, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {

			// Récupérer la variable
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				String errorMsg = "Variable introuvable : " + variableName;
				log.error(errorMsg);
				throw new IOException(errorMsg);
			}

			log.debug("Variable trouvée : {} (dimensions: {})", variableName, variable.getDimensions());

			// Lire les données (format: [time, altitude, lat, lon])
			ucar.ma2.Array data = variable.read();

			// Extraire la slice 2D à (timeIndex, altitudeIndex, :, :)
			int[] shape = data.getShape();
			int nLat = shape[2];
			int nLon = shape[3];

			float[][] slice = new float[nLat][nLon];

			ucar.ma2.Index index = data.getIndex();
			for (int lat = 0; lat < nLat; lat++) {
				for (int lon = 0; lon < nLon; lon++) {
					index.set(timeIndex, altitudeIndex, lat, lon);
					slice[lat][lon] = data.getFloat(index);
				}
			}

			log.info("Slice 2D extraite : {}x{} valeurs", nLat, nLon);

			return slice;
		}
	}

	/**
	 * Liste les variables disponibles dans un fichier MEAN.
	 * 
	 * @param filename nom du fichier MEAN
	 * @return liste des noms de variables
	 * @throws IOException si erreur lecture
	 */
	public List<String> listVariables(String filename) throws IOException {
		log.debug("Liste des variables pour : {}", filename);

		List<String> variableNames = new ArrayList<>();

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			for (ucar.nc2.Variable var : ncfile.getVariables()) {
				variableNames.add(var.getShortName());
			}
		}

		log.info("Variables trouvées : {} variables", variableNames.size());

		return variableNames;
	}

	/**
	 * Extrait une slice 2D avec les coordonnées géo. Version qui retourne aussi les
	 * latitudes et longitudes.
	 * 
	 * @param filename      nom du fichier MEAN
	 * @param variableName  nom de la variable
	 * @param timeIndex     index temporel
	 * @param altitudeIndex index altitude
	 * @return Map contenant data, latitudes, longitudes
	 * @throws IOException si erreur lecture
	 */
	public Map<String, Object> extractSlice2DWithCoords(String filename, String variableName, int timeIndex,
			int altitudeIndex) throws IOException {

		log.info("Extraction slice 2D avec coordonnées : fichier={}, variable={}, time={}, altitude={}", filename,
				variableName, timeIndex, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {

			// Récupérer la variable
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				String errorMsg = "Variable introuvable : " + variableName;
				log.error(errorMsg);
				throw new IOException(errorMsg);
			}

			// Lire les données
			ucar.ma2.Array data = variable.read();

			// Extraire la slice 2D
			int[] shape = data.getShape();
			int nLat = shape[2];
			int nLon = shape[3];

			float[][] slice = new float[nLat][nLon];

			ucar.ma2.Index index = data.getIndex();
			for (int lat = 0; lat < nLat; lat++) {
				for (int lon = 0; lon < nLon; lon++) {
					index.set(timeIndex, altitudeIndex, lat, lon);
					slice[lat][lon] = data.getFloat(index);
				}
			}

			// Extraire les coordonnées lat/lon
			double[] latitudes = extractCoordinates(ncfile, "lat");
			double[] longitudes = extractCoordinates(ncfile, "lon");

			// Construire la réponse
			Map<String, Object> result = new HashMap<>();
			result.put("data", slice);
			result.put("latitudes", latitudes);
			result.put("longitudes", longitudes);

			log.info("Slice 2D extraite avec coordonnées : {}x{}", nLat, nLon);

			return result;
		}
	}

	/**
	 * Extrait les valeurs d'une coordonnée (lat ou lon).
	 * 
	 * @param ncfile    fichier NetCDF ouvert
	 * @param coordName nom de la coordonnée (lat ou lon)
	 * @return tableau des valeurs de coordonnées
	 * @throws IOException si erreur lecture
	 */
	private double[] extractCoordinates(NetcdfFile ncfile, String coordName) throws IOException {
		ucar.nc2.Variable coordVar = ncfile.findVariable(coordName);
		if (coordVar == null) {
			log.warn("Coordonnée {} introuvable, utilisation d'indices", coordName);
			return null;
		}

		ucar.ma2.Array coordArray = coordVar.read();
		int size = (int) coordArray.getSize();
		double[] coords = new double[size];

		for (int i = 0; i < size; i++) {
			coords[i] = coordArray.getDouble(i);
		}

		log.debug("Coordonnées {} extraites : {} valeurs [{} à {}]", coordName, size, coords[0], coords[size - 1]);

		return coords;
	}
}