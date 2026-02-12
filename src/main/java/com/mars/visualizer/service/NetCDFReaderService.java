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
import com.mars.visualizer.exception.NetCDFException;

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

			// Lire les données
			ucar.ma2.Array data = variable.read();

			// Variables de surface (3D : time, lat, lon) vs atmosphériques (4D : time, alt, lat, lon)
			int[]   shape     = data.getShape();
			boolean isSurface = (shape.length == 3);
			int     nLat      = isSurface ? shape[1] : shape[2];
			int     nLon      = isSurface ? shape[2] : shape[3];

			float[][] slice = new float[nLat][nLon];

			ucar.ma2.Index index = data.getIndex();
			for (int lat = 0; lat < nLat; lat++) {
				for (int lon = 0; lon < nLon; lon++) {
					if (isSurface) {
						index.set(timeIndex, lat, lon);
					} else {
						index.set(timeIndex, altitudeIndex, lat, lon);
					}
					slice[lat][lon] = data.getFloat(index);
				}
			}

			log.info("Slice 2D extraite : {}x{} valeurs (surface={})", nLat, nLon, isSurface);

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
	 * @throws NetCDFException si erreur lecture
	 */
	public Map<String, Object> extractSlice2DWithCoords(String filename, String variableName, int timeIndex,
			int altitudeIndex) {

		log.info("Extraction slice 2D avec coordonnées : fichier={}, variable={}, time={}, altitude={}", filename,
				variableName, timeIndex, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {

			// Récupérer la variable
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("Variable introuvable : " + variableName);
			}

			// Lire les données
			ucar.ma2.Array data = variable.read();

			// Variables de surface (3D : time, lat, lon) vs atmosphériques (4D : time, alt, lat, lon)
			int[]   shape     = data.getShape();
			boolean isSurface = (shape.length == 3);
			int     nLat      = isSurface ? shape[1] : shape[2];
			int     nLon      = isSurface ? shape[2] : shape[3];

			float[][] slice = new float[nLat][nLon];

			ucar.ma2.Index index = data.getIndex();
			for (int lat = 0; lat < nLat; lat++) {
				for (int lon = 0; lon < nLon; lon++) {
					if (isSurface) {
						index.set(timeIndex, lat, lon);
					} else {
						index.set(timeIndex, altitudeIndex, lat, lon);
					}
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

			log.info("Slice 2D extraite avec coordonnées : {}x{} (surface={})", nLat, nLon, isSurface);

			return result;

		} catch (NetCDFException e) {
			throw e;
		} catch (IOException e) {
			throw new NetCDFException("Erreur lecture slice 2D dans '" + filename + "'", e);
		}
	}

	// =========================================================================
	// Méthodes ajoutées
	// =========================================================================

	/**
	 * Extrait une série temporelle (48 valeurs) en un point géographique.
	 * Utilisé pour UC3 (analyse série temporelle).
	 * <p>
	 * Algorithme :
	 * <ol>
	 *   <li>Ouvre le fichier NetCDF</li>
	 *   <li>Lit les coordonnées lat/lon du fichier</li>
	 *   <li>Trouve les indices lat/lon les plus proches du point demandé</li>
	 *   <li>Extrait les 48 valeurs (tous les timesteps) à
	 *       [time=0..47, alt=altitudeIndex, lat=idx, lon=idx]</li>
	 * </ol>
	 *
	 * @param filename      nom du fichier MEAN
	 * @param variableName  variable à extraire (ex: TT)
	 * @param latitude      latitude du point (-90 à 90)
	 * @param longitude     longitude du point (-180 à 180)
	 * @param altitudeIndex index d'altitude (0-102)
	 * @return liste de 48 valeurs (une par timestep)
	 * @throws NetCDFException si erreur lecture NetCDF
	 * @author Ludo
	 * @version 1.0
	 */
	public List<Float> extractTimeSeries(String filename, String variableName, double latitude, double longitude,
			int altitudeIndex) {

		log.info("Extraction série temporelle : fichier={}, variable={}, lat={}, lon={}, altitude={}", filename,
				variableName, latitude, longitude, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {

			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("Variable introuvable : " + variableName);
			}

			// Lire les coordonnées pour trouver les indices les plus proches
			double[] latitudes  = extractCoordinates(ncfile, "lat");
			double[] longitudes = extractCoordinates(ncfile, "lon");

			int latIdx = findNearestIndex(latitudes,  latitude);
			int lonIdx = findNearestIndex(longitudes, longitude);

			log.debug("Indices les plus proches : latIdx={}, lonIdx={}", latIdx, lonIdx);

			// Lire les données
			ucar.ma2.Array data  = variable.read();
			int[]          shape = data.getShape();
			boolean     isSurface = (shape.length == 3);
			int            nTime = shape[0];

			ucar.ma2.Index index  = data.getIndex();
			List<Float>    series = new ArrayList<>(nTime);

			for (int t = 0; t < nTime; t++) {
				if (isSurface) {
					index.set(t, latIdx, lonIdx);
				} else {
					index.set(t, altitudeIndex, latIdx, lonIdx);
				}
				series.add(data.getFloat(index));
			}

			log.debug("Série temporelle extraite : {} valeurs (surface={})", series.size(), isSurface);

			return series;

		} catch (NetCDFException e) {
			throw e;
		} catch (IOException e) {
			throw new NetCDFException("Erreur lecture série temporelle dans '" + filename + "'", e);
		}
	}

	/**
	 * Extrait 48 frames pour animation diurne (UC5).
	 * Chaque frame est une slice 2D [lat][lon] à un timestep différent.
	 * <p>
	 * Utilisé pour visualiser le cycle jour/nuit complet sur Mars.
	 *
	 * @param filename      nom du fichier MEAN
	 * @param variableName  variable à extraire
	 * @param altitudeIndex index d'altitude
	 * @return liste de 48 frames ({@code float[][]})
	 * @throws NetCDFException si erreur lecture NetCDF
	 * @author Ludo
	 * @version 1.0
	 */
	public List<float[][]> extractAnimationFrames(String filename, String variableName, int altitudeIndex) {

		log.info("Extraction frames animation : fichier={}, variable={}, altitude={}", filename, variableName,
				altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {

			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("Variable introuvable : " + variableName);
			}

			ucar.ma2.Array data  = variable.read();
			int[]          shape = data.getShape();
			int            nDims = shape.length;
			int            nTime = shape[0];

			// Variables de surface (3D : time, lat, lon) vs atmosphériques (4D : time, alt, lat, lon)
			boolean isSurface = (nDims == 3);
			int     nLat      = isSurface ? shape[1] : shape[2];
			int     nLon      = isSurface ? shape[2] : shape[3];

			ucar.ma2.Index  index  = data.getIndex();
			List<float[][]> frames = new ArrayList<>(nTime);

			for (int t = 0; t < nTime; t++) {
				float[][] frame = new float[nLat][nLon];
				for (int lat = 0; lat < nLat; lat++) {
					for (int lon = 0; lon < nLon; lon++) {
						if (isSurface) {
							index.set(t, lat, lon);
						} else {
							index.set(t, altitudeIndex, lat, lon);
						}
						frame[lat][lon] = data.getFloat(index);
					}
				}
				frames.add(frame);
			}

			log.debug("Frames animation extraites : {} frames de {}x{} (surface={})", nTime, nLat, nLon, isSurface);

			return frames;

		} catch (NetCDFException e) {
			throw e;
		} catch (IOException e) {
			throw new NetCDFException("Erreur lecture frames animation dans '" + filename + "'", e);
		}
	}

	// =========================================================================
	// Méthodes privées
	// =========================================================================

	/**
	 * Trouve l'index du tableau de coordonnées dont la valeur est la plus proche
	 * de la coordonnée cible.
	 *
	 * @param coords coordonnées extraites du fichier NetCDF (lat ou lon)
	 * @param target valeur cible (latitude ou longitude demandée)
	 * @return index le plus proche dans le tableau
	 * @throws NetCDFException si le tableau de coordonnées est null ou vide
	 */
	private int findNearestIndex(double[] coords, double target) {
		if (coords == null || coords.length == 0) {
			throw new NetCDFException("Coordonnées introuvables dans le fichier NetCDF.");
		}

		int    bestIdx  = 0;
		double bestDist = Math.abs(coords[0] - target);

		for (int i = 1; i < coords.length; i++) {
			double dist = Math.abs(coords[i] - target);
			if (dist < bestDist) {
				bestDist = dist;
				bestIdx  = i;
			}
		}

		log.debug("findNearestIndex : target={}, idx={}, valeur={}", target, bestIdx, coords[bestIdx]);

		return bestIdx;
	}

	/**
	 * Extrait la valeur réelle de l'altitude à un index donné pour une variable.
	 * <p>
	 * Détermine automatiquement la variable de coordonnée d'altitude (altitudeT
	 * ou altitudeM) en inspectant la 2ème dimension de la variable de données.
	 * Retourne {@code null} pour les variables de surface (3D).
	 *
	 * @param filename      nom du fichier MEAN
	 * @param variableName  variable de données (ex: TT, UU)
	 * @param altitudeIndex index d'altitude (0-102)
	 * @return altitude réelle en km, ou {@code null} si variable de surface
	 * @throws NetCDFException si erreur lecture
	 */
	public Double extractAltitudeValue(String filename, String variableName, int altitudeIndex) {
		log.debug("Extraction altitude réelle : fichier={}, variable={}, index={}",
				filename, variableName, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("Variable '" + variableName + "' introuvable dans " + filename);
			}

			int[] shape = variable.getShape();
			if (shape.length == 3) {
				log.debug("Variable de surface, pas d'altitude");
				return null;
			}

			// La dimension d'altitude est la 2ème (index 1) pour les variables 4D
			String altDimName = variable.getDimension(1).getShortName();
			log.debug("Dimension d'altitude détectée : {}", altDimName);

			double[] altCoords = extractCoordinates(ncfile, altDimName);
			if (altCoords == null || altitudeIndex >= altCoords.length) {
				log.warn("Coordonnées d'altitude introuvables ou index hors bornes");
				return null;
			}

			double value = altCoords[altitudeIndex];
			log.debug("Altitude réelle : index {} → {} km", altitudeIndex, value);
			return value;

		} catch (NetCDFException e) {
			throw e;
		} catch (IOException e) {
			throw new NetCDFException("Erreur lecture altitude dans '" + filename + "'", e);
		}
	}

	/**
	 * Extrait les valeurs d'une coordonnée (lat, lon, altitudeT, altitudeM…).
	 *
	 * @param ncfile    fichier NetCDF ouvert
	 * @param coordName nom de la coordonnée
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