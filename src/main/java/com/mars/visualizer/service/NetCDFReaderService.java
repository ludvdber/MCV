package com.mars.visualizer.service;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
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
 *
 * <p>Toutes les extractions utilisent des <em>lectures partielles</em>
 * ({@code variable.read(int[] origin, int[] shape)}) pour ne charger
 * en mémoire que la portion réellement nécessaire du tenseur 4D
 * {@code [time][altitude][lat][lon]}.
 *
 * <p>Gains mémoire typiques (variable TT, 48×103×361×361) :
 * <ul>
 *   <li>Slice 2D : ×5 000 moins de mémoire</li>
 *   <li>Série temporelle : ×13 000 000 moins</li>
 *   <li>Animation (48 frames, 1 altitude) : ×103 moins</li>
 *   <li>Profil vertical (1 colonne) : ×6 000 000 moins</li>
 *   <li>Coupe verticale : ×17 000 moins</li>
 * </ul>
 */
@Service
@Slf4j
public class NetCDFReaderService {

	private final DataPathConfig pathConfig;

	public NetCDFReaderService(DataPathConfig pathConfig) {
		this.pathConfig = pathConfig;
		log.info("NetCDFReaderService initialisé");
	}

	// =========================================================================
	// Liste et ouverture de fichiers
	// =========================================================================

	/**
	 * Liste tous les fichiers MEAN disponibles dans le répertoire.
	 */
	public List<String> listMeanFiles() throws IOException {
		log.debug("Lecture du répertoire MEAN : {}", pathConfig.getMeanPath());

		List<String> meanFiles = new ArrayList<>();
		Path meanDir = pathConfig.getMeanPath();

		try (DirectoryStream<Path> stream = Files.newDirectoryStream(meanDir, "*.nc")) {
			for (Path entry : stream) {
				if (Files.isRegularFile(entry)) {
					meanFiles.add(entry.getFileName().toString());
				}
			}
		}

		Collections.sort(meanFiles);
		log.info("Fichiers MEAN trouvés : {} fichiers", meanFiles.size());
		return meanFiles;
	}

	/**
	 * Ouvre un fichier MEAN (ou chemin absolu INDIVIDUAL) et retourne l'objet NetcdfFile.
	 * Le fichier DOIT être fermé après utilisation (try-with-resources).
	 */
	public NetcdfFile openMeanFile(String filename) throws IOException {
		Path filePath = Path.of(filename);
		if (!filePath.isAbsolute()) {
			filePath = pathConfig.getMeanPath().resolve(filename);
		}

		if (!Files.exists(filePath)) {
			String errorMsg = "Fichier NetCDF introuvable : " + filePath;
			log.error(errorMsg);
			throw new IOException(errorMsg);
		}

		log.debug("Ouverture fichier NetCDF : {}", filePath);
		NetcdfFile ncfile = NetcdfFiles.open(filePath.toString());
		log.info("Fichier NetCDF ouvert : {} (taille: {} octets)",
				filePath.getFileName(), Files.size(filePath));
		return ncfile;
	}

	/**
	 * Lit les métadonnées d'un fichier MEAN sans charger toutes les données.
	 */
	public String getMeanFileInfo(String filename) throws IOException {
		try (NetcdfFile ncfile = openMeanFile(filename)) {
			StringBuilder info = new StringBuilder();
			info.append("Fichier : ").append(filename).append("\n");
			info.append("Format : ").append(ncfile.getFileTypeDescription()).append("\n");
			info.append("Dimensions : ").append(ncfile.getRootGroup().getDimensions()).append("\n");
			info.append("Variables globales : ").append(ncfile.getVariables().size()).append("\n");
			return info.toString();
		}
	}

	/**
	 * Vérifie si un fichier MEAN existe.
	 */
	public boolean meanFileExists(String filename) {
		Path filePath = pathConfig.getMeanPath().resolve(filename);
		return Files.exists(filePath);
	}

	/**
	 * Liste les variables disponibles dans un fichier MEAN.
	 */
	public List<String> listVariables(String filename) throws IOException {
		List<String> variableNames = new ArrayList<>();
		try (NetcdfFile ncfile = openMeanFile(filename)) {
			for (ucar.nc2.Variable var : ncfile.getVariables()) {
				variableNames.add(var.getShortName());
			}
		}
		log.info("Variables trouvées : {} variables", variableNames.size());
		return variableNames;
	}

	// =========================================================================
	// Extraction de données — lectures partielles
	// =========================================================================

	/**
	 * Extrait une slice 2D d'une variable à une altitude et un temps donnés.
	 * Lecture partielle : {@code 1×1×nLat×nLon} (variables 4D) ou
	 * {@code 1×nLat×nLon} (variables de surface 3D).
	 *
	 * @param filename      nom du fichier MEAN
	 * @param variableName  nom de la variable (ex: "TT")
	 * @param timeIndex     index temporel (0-47)
	 * @param altitudeIndex index altitude (0-102)
	 * @return tableau 2D [lat][lon] des valeurs
	 */
	public float[][] extractSlice2D(String filename, String variableName, int timeIndex, int altitudeIndex)
			throws IOException {

		log.info("Extraction slice 2D : fichier={}, variable={}, time={}, altitude={}",
				filename, variableName, timeIndex, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new IOException("Variable introuvable : " + variableName);
			}

			int[]     varShape  = variable.getShape();
			boolean   isSurface = (varShape.length == 3);
			int       nLat      = isSurface ? varShape[1] : varShape[2];
			int       nLon      = isSurface ? varShape[2] : varShape[3];
			float[][] slice     = new float[nLat][nLon];

			ucar.ma2.Array data = isSurface
				? readSection(variable, new int[]{timeIndex, 0, 0},               new int[]{1, nLat, nLon})
				: readSection(variable, new int[]{timeIndex, altitudeIndex, 0, 0}, new int[]{1, 1, nLat, nLon});

			ucar.ma2.Index index = data.getIndex();
			for (int lat = 0; lat < nLat; lat++) {
				for (int lon = 0; lon < nLon; lon++) {
					slice[lat][lon] = data.getFloat(
						isSurface ? index.set(0, lat, lon) : index.set(0, 0, lat, lon));
				}
			}

			log.info("Slice 2D extraite : {}x{} (surface={})", nLat, nLon, isSurface);
			return slice;
		}
	}

	/**
	 * Extrait une slice 2D avec les coordonnées géo.
	 * Lecture partielle : {@code 1×1×nLat×nLon} au lieu du tenseur complet.
	 *
	 * @return Map contenant "data" (float[][]), "latitudes" (double[]), "longitudes" (double[])
	 */
	public Map<String, Object> extractSlice2DWithCoords(String filename, String variableName,
			int timeIndex, int altitudeIndex) {

		log.info("Extraction slice 2D avec coordonnées : fichier={}, variable={}, time={}, altitude={}",
				filename, variableName, timeIndex, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("Variable introuvable : " + variableName);
			}

			int[]     varShape  = variable.getShape();
			boolean   isSurface = (varShape.length == 3);
			int       nLat      = isSurface ? varShape[1] : varShape[2];
			int       nLon      = isSurface ? varShape[2] : varShape[3];
			float[][] slice     = new float[nLat][nLon];

			ucar.ma2.Array data = isSurface
				? readSection(variable, new int[]{timeIndex, 0, 0},               new int[]{1, nLat, nLon})
				: readSection(variable, new int[]{timeIndex, altitudeIndex, 0, 0}, new int[]{1, 1, nLat, nLon});

			ucar.ma2.Index index = data.getIndex();
			for (int lat = 0; lat < nLat; lat++) {
				for (int lon = 0; lon < nLon; lon++) {
					slice[lat][lon] = data.getFloat(
						isSurface ? index.set(0, lat, lon) : index.set(0, 0, lat, lon));
				}
			}

			double[] latitudes  = extractCoordinates(ncfile, "lat");
			double[] longitudes = extractCoordinates(ncfile, "lon");

			Map<String, Object> result = new HashMap<>();
			result.put("data",       slice);
			result.put("latitudes",  latitudes);
			result.put("longitudes", longitudes);

			log.info("Slice 2D extraite avec coordonnées : {}x{} (surface={})", nLat, nLon, isSurface);
			return result;

		} catch (NetCDFException e) {
			throw e;
		} catch (IOException e) {
			throw new NetCDFException("Erreur lecture slice 2D dans '" + filename + "'", e);
		}
	}

	/**
	 * Extrait une série temporelle (48 valeurs) en un point géographique.
	 * Lecture partielle : {@code nTime×1×1×1} — une seule cellule lat/lon.
	 *
	 * @param filename      nom du fichier MEAN
	 * @param variableName  variable à extraire
	 * @param latitude      latitude du point (-90 à 90)
	 * @param longitude     longitude du point (-180 à 180)
	 * @param altitudeIndex index d'altitude (0-102)
	 * @return liste de 48 valeurs
	 */
	public List<Float> extractTimeSeries(String filename, String variableName,
			double latitude, double longitude, int altitudeIndex) {

		log.info("Extraction série temporelle : fichier={}, variable={}, lat={}, lon={}, altitude={}",
				filename, variableName, latitude, longitude, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("Variable introuvable : " + variableName);
			}

			double[] latitudes  = extractCoordinates(ncfile, "lat");
			double[] longitudes = extractCoordinates(ncfile, "lon");
			int      latIdx     = findNearestIndex(latitudes,  latitude);
			int      lonIdx     = findNearestIndex(longitudes, longitude);

			log.debug("Indices les plus proches : latIdx={}, lonIdx={}", latIdx, lonIdx);

			int[]   varShape  = variable.getShape();
			boolean isSurface = (varShape.length == 3);
			int     nTime     = varShape[0];

			ucar.ma2.Array data = isSurface
				? readSection(variable, new int[]{0, latIdx, lonIdx},                new int[]{nTime, 1, 1})
				: readSection(variable, new int[]{0, altitudeIndex, latIdx, lonIdx}, new int[]{nTime, 1, 1, 1});

			ucar.ma2.Index index  = data.getIndex();
			List<Float>    series = new ArrayList<>(nTime);
			for (int t = 0; t < nTime; t++) {
				series.add(data.getFloat(isSurface ? index.set(t, 0, 0) : index.set(t, 0, 0, 0)));
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
	 * Extrait 48 frames pour animation diurne.
	 * Lecture partielle : {@code nTime×1×nLat×nLon} (variables 4D).
	 *
	 * <p>Retourne également les coordonnées lat/lon dans le même {@code Map}
	 * afin d'éviter une seconde ouverture du fichier dans le contrôleur.
	 *
	 * @param filename      nom du fichier MEAN
	 * @param variableName  variable à extraire
	 * @param altitudeIndex index d'altitude
	 * @return Map contenant "frames" (List&lt;float[][]&gt;),
	 *         "latitudes" (double[]), "longitudes" (double[])
	 */
	public Map<String, Object> extractAnimationFrames(String filename, String variableName, int altitudeIndex) {

		log.info("Extraction frames animation : fichier={}, variable={}, altitude={}",
				filename, variableName, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("Variable introuvable : " + variableName);
			}

			int[]   varShape  = variable.getShape();
			boolean isSurface = (varShape.length == 3);
			int     nTime     = varShape[0];
			int     nLat      = isSurface ? varShape[1] : varShape[2];
			int     nLon      = isSurface ? varShape[2] : varShape[3];

			// Lecture partielle : tous les temps, une seule altitude, toute la grille lat/lon
			ucar.ma2.Array data = isSurface
				? readSection(variable, new int[]{0, 0, 0},               new int[]{nTime, nLat, nLon})
				: readSection(variable, new int[]{0, altitudeIndex, 0, 0}, new int[]{nTime, 1, nLat, nLon});

			ucar.ma2.Index  index  = data.getIndex();
			List<float[][]> frames = new ArrayList<>(nTime);

			for (int t = 0; t < nTime; t++) {
				float[][] frame = new float[nLat][nLon];
				for (int lat = 0; lat < nLat; lat++) {
					for (int lon = 0; lon < nLon; lon++) {
						frame[lat][lon] = data.getFloat(
							isSurface ? index.set(t, lat, lon) : index.set(t, 0, lat, lon));
					}
				}
				frames.add(frame);
			}

			// Coordonnées extraites dans le même try-with-resources → pas de 2ème ouverture
			double[] latitudes  = extractCoordinates(ncfile, "lat");
			double[] longitudes = extractCoordinates(ncfile, "lon");

			log.debug("Frames animation extraites : {} frames de {}x{} (surface={})",
					nTime, nLat, nLon, isSurface);

			Map<String, Object> result = new HashMap<>();
			result.put("frames",     frames);
			result.put("latitudes",  latitudes);
			result.put("longitudes", longitudes);
			return result;

		} catch (NetCDFException e) {
			throw e;
		} catch (IOException e) {
			throw new NetCDFException("Erreur lecture frames animation dans '" + filename + "'", e);
		}
	}

	/**
	 * Extrait un profil vertical (toutes les altitudes) en un point et un instant.
	 * Lecture partielle : {@code 1×nAlt×1×1} — une seule colonne atmosphérique.
	 * Réservé aux variables 4D. Lève une exception pour les variables de surface.
	 *
	 * @return Map contenant "values" (List&lt;Float&gt;), "altitudes" (double[]),
	 *         "actualLat" (double), "actualLon" (double)
	 */
	public Map<String, Object> extractVerticalProfile(String filename, String variableName,
			int timeIndex, double latitude, double longitude) {

		log.info("Extraction profil vertical : fichier={}, variable={}, time={}, lat={}, lon={}",
				filename, variableName, timeIndex, latitude, longitude);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("Variable introuvable : " + variableName);
			}

			int[] varShape = variable.getShape();
			if (varShape.length == 3) {
				throw new NetCDFException(
					"Variable de surface '" + variableName + "' : pas de dimension altitude pour un profil vertical.");
			}

			double[] latitudes  = extractCoordinates(ncfile, "lat");
			double[] longitudes = extractCoordinates(ncfile, "lon");
			int      latIdx     = findNearestIndex(latitudes,  latitude);
			int      lonIdx     = findNearestIndex(longitudes, longitude);

			String   altDimName = variable.getDimension(1).getShortName();
			double[] altCoords  = extractCoordinates(ncfile, altDimName);
			int      nAlt       = varShape[1];

			// Lecture partielle : un seul temps, toutes altitudes, un seul point lat/lon
			ucar.ma2.Array data  = readSection(variable,
				new int[]{timeIndex, 0, latIdx, lonIdx}, new int[]{1, nAlt, 1, 1});
			ucar.ma2.Index index = data.getIndex();

			List<Float> values = new ArrayList<>(nAlt);
			for (int a = 0; a < nAlt; a++) {
				values.add(data.getFloat(index.set(0, a, 0, 0)));
			}

			Map<String, Object> result = new HashMap<>();
			result.put("values",    values);
			result.put("altitudes", altCoords);
			result.put("actualLat", latitudes[latIdx]);
			result.put("actualLon", longitudes[lonIdx]);

			log.info("Profil vertical extrait : {} niveaux", nAlt);
			return result;

		} catch (NetCDFException e) {
			throw e;
		} catch (IOException e) {
			throw new NetCDFException("Erreur lecture profil vertical dans '" + filename + "'", e);
		}
	}

	/**
	 * Extrait une coupe verticale (méridionale ou zonale) en un instant.
	 * Lecture partielle :
	 * <ul>
	 *   <li>Méridionale : {@code 1×nAlt×nLat×1} (longitude fixée)</li>
	 *   <li>Zonale      : {@code 1×nAlt×1×nLon} (latitude fixée)</li>
	 * </ul>
	 * Réservé aux variables 4D.
	 *
	 * @return Map contenant "data" (float[][]), "altitudes" (double[]),
	 *         "horizontalCoords" (double[]), "fixedValue" (double)
	 */
	public Map<String, Object> extractCrossSection(String filename, String variableName,
			int timeIndex, String type, double fixedCoordinate) {

		log.info("Extraction coupe verticale : fichier={}, variable={}, time={}, type={}, fixed={}",
				filename, variableName, timeIndex, type, fixedCoordinate);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("Variable introuvable : " + variableName);
			}

			int[] varShape = variable.getShape();
			if (varShape.length == 3) {
				throw new NetCDFException(
					"Variable de surface '" + variableName + "' : pas de dimension altitude pour une coupe verticale.");
			}

			double[] latitudes  = extractCoordinates(ncfile, "lat");
			double[] longitudes = extractCoordinates(ncfile, "lon");
			String   altDimName = variable.getDimension(1).getShortName();
			double[] altCoords  = extractCoordinates(ncfile, altDimName);

			int nAlt = varShape[1];
			int nLat = varShape[2];
			int nLon = varShape[3];

			float[]  horizontalCoords;
			float[][] section;
			double    actualFixed;

			if ("meridional".equals(type)) {
				int lonIdx = findNearestIndex(longitudes, fixedCoordinate);
				actualFixed = longitudes[lonIdx];

				// 1×nAlt×nLat×1
				ucar.ma2.Array data  = readSection(variable,
					new int[]{timeIndex, 0, 0, lonIdx}, new int[]{1, nAlt, nLat, 1});
				ucar.ma2.Index index = data.getIndex();

				section          = new float[nAlt][nLat];
				horizontalCoords = new float[latitudes.length];
				for (int i = 0; i < latitudes.length; i++) horizontalCoords[i] = (float) latitudes[i];

				for (int a = 0; a < nAlt; a++) {
					for (int lat = 0; lat < nLat; lat++) {
						section[a][lat] = data.getFloat(index.set(0, a, lat, 0));
					}
				}

			} else if ("zonal".equals(type)) {
				int latIdx = findNearestIndex(latitudes, fixedCoordinate);
				actualFixed = latitudes[latIdx];

				// 1×nAlt×1×nLon
				ucar.ma2.Array data  = readSection(variable,
					new int[]{timeIndex, 0, latIdx, 0}, new int[]{1, nAlt, 1, nLon});
				ucar.ma2.Index index = data.getIndex();

				section          = new float[nAlt][nLon];
				horizontalCoords = new float[longitudes.length];
				for (int i = 0; i < longitudes.length; i++) horizontalCoords[i] = (float) longitudes[i];

				for (int a = 0; a < nAlt; a++) {
					for (int lon = 0; lon < nLon; lon++) {
						section[a][lon] = data.getFloat(index.set(0, a, 0, lon));
					}
				}

			} else {
				throw new NetCDFException(
					"Type de coupe invalide : '" + type + "'. Attendu : 'meridional' ou 'zonal'.");
			}

			// Convertir float[] → double[] pour la réponse (cohérence avec l'API existante)
			double[] hCoords = new double[horizontalCoords.length];
			for (int i = 0; i < horizontalCoords.length; i++) hCoords[i] = horizontalCoords[i];

			Map<String, Object> result = new HashMap<>();
			result.put("data",             section);
			result.put("altitudes",        altCoords);
			result.put("horizontalCoords", hCoords);
			result.put("fixedValue",       actualFixed);

			log.info("Coupe verticale {} extraite : {}x{}", type, section.length, section[0].length);
			return result;

		} catch (NetCDFException e) {
			throw e;
		} catch (IOException e) {
			throw new NetCDFException("Erreur lecture coupe verticale dans '" + filename + "'", e);
		}
	}

	/**
	 * Extrait un champ de vent (UU, VV) subsamplé à un instant et une altitude.
	 * Lecture partielle : {@code 1×1×nLat×nLon} pour UU et VV.
	 * Retourne un point sur {@code step} en lat et lon pour réduire la densité.
	 * Si UU ou VV est absent, retourne des tableaux vides.
	 *
	 * @return Map contenant "lats" (double[]), "lons" (double[]),
	 *         "u" (double[]), "v" (double[]) — même taille
	 */
	public Map<String, Object> extractWindField(String filename, int timeIndex, int altitudeIndex) {

		log.info("Extraction champ de vent : fichier={}, time={}, altitude={}", filename, timeIndex, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable uuVar = ncfile.findVariable("UU");
			ucar.nc2.Variable vvVar = ncfile.findVariable("VV");

			if (uuVar == null || vvVar == null) {
				log.warn("Variables UU ou VV absentes dans {} — champ de vent non disponible", filename);
				Map<String, Object> empty = new HashMap<>();
				empty.put("lats", new double[0]);
				empty.put("lons", new double[0]);
				empty.put("u",    new double[0]);
				empty.put("v",    new double[0]);
				return empty;
			}

			double[] latCoords = extractCoordinates(ncfile, "lat");
			double[] lonCoords = extractCoordinates(ncfile, "lon");
			int      nLat      = latCoords.length;
			int      nLon      = lonCoords.length;

			// Lecture partielle : un seul temps, une seule altitude, toute la grille
			ucar.ma2.Array uData = readSection(uuVar,
				new int[]{timeIndex, altitudeIndex, 0, 0}, new int[]{1, 1, nLat, nLon});
			ucar.ma2.Array vData = readSection(vvVar,
				new int[]{timeIndex, altitudeIndex, 0, 0}, new int[]{1, 1, nLat, nLon});

			ucar.ma2.Index uIdx = uData.getIndex();
			ucar.ma2.Index vIdx = vData.getIndex();

			int step = 3; // 1 vecteur sur 3 en lat et lon
			int cLat = 0; for (int la = 0; la < nLat; la += step) cLat++;
			int cLon = 0; for (int lo = 0; lo < nLon; lo += step) cLon++;
			int total = cLat * cLon;

			double[] latsArr = new double[total];
			double[] lonsArr = new double[total];
			double[] uArr    = new double[total];
			double[] vArr    = new double[total];

			int k = 0;
			for (int la = 0; la < nLat; la += step) {
				for (int lo = 0; lo < nLon; lo += step) {
					uIdx.set(0, 0, la, lo);
					vIdx.set(0, 0, la, lo);
					latsArr[k] = latCoords[la];
					lonsArr[k] = lonCoords[lo];
					uArr[k]    = uData.getFloat(uIdx);
					vArr[k]    = vData.getFloat(vIdx);
					k++;
				}
			}

			Map<String, Object> result = new HashMap<>();
			result.put("lats", latsArr);
			result.put("lons", lonsArr);
			result.put("u",    uArr);
			result.put("v",    vArr);

			log.info("Champ de vent extrait : {} vecteurs ({}x{} grid, step={})", k, cLat, cLon, step);
			return result;

		} catch (NetCDFException e) {
			throw e;
		} catch (IOException e) {
			throw new NetCDFException("Erreur lecture champ de vent dans '" + filename + "'", e);
		}
	}

	/**
	 * Extrait la valeur réelle de l'altitude à un index donné pour une variable.
	 * Retourne {@code null} pour les variables de surface (3D).
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

			String   altDimName = variable.getDimension(1).getShortName();
			double[] altCoords  = extractCoordinates(ncfile, altDimName);
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

	// =========================================================================
	// Méthodes utilitaires
	// =========================================================================

	/**
	 * Lecture partielle d'une variable NetCDF (section).
	 * Convertit {@code InvalidRangeException} (checked UCAR) en {@code NetCDFException} (runtime).
	 *
	 * @param variable variable NetCDF à lire
	 * @param origin   indices de départ pour chaque dimension
	 * @param shape    taille à lire pour chaque dimension
	 * @return tableau de données pour la section demandée
	 */
	private ucar.ma2.Array readSection(ucar.nc2.Variable variable, int[] origin, int[] shape) {
		try {
			return variable.read(origin, shape);
		} catch (IOException e) {
			throw new NetCDFException("Erreur I/O lecture section NetCDF [" +
				variable.getShortName() + "]", e);
		} catch (ucar.ma2.InvalidRangeException e) {
			throw new NetCDFException(
				"Section hors bornes pour '" + variable.getShortName() + "' " +
				"[origin=" + Arrays.toString(origin) + ", shape=" + Arrays.toString(shape) + "]", e);
		}
	}

	/**
	 * Trouve l'index le plus proche de la coordonnée cible dans un tableau trié.
	 *
	 * @param coords coordonnées extraites du fichier NetCDF
	 * @param target valeur cible
	 * @return index le plus proche
	 */
	public int findNearestIndex(double[] coords, double target) {
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
	 * Extrait les valeurs d'une coordonnée (lat, lon, altitudeT, altitudeM…).
	 *
	 * @param ncfile    fichier NetCDF ouvert
	 * @param coordName nom de la coordonnée
	 * @return tableau des valeurs, ou {@code null} si la variable est absente
	 */
	private double[] extractCoordinates(NetcdfFile ncfile, String coordName) throws IOException {
		ucar.nc2.Variable coordVar = ncfile.findVariable(coordName);
		if (coordVar == null) {
			log.warn("Coordonnée {} introuvable, utilisation d'indices", coordName);
			return null;
		}

		ucar.ma2.Array coordArray = coordVar.read();
		int    size   = (int) coordArray.getSize();
		double[] coords = new double[size];
		for (int i = 0; i < size; i++) {
			coords[i] = coordArray.getDouble(i);
		}

		log.debug("Coordonnées {} extraites : {} valeurs [{} à {}]",
				coordName, size, coords[0], coords[size - 1]);
		return coords;
	}
}
