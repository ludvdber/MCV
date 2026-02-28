package com.mars.visualizer.service;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

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

	// Records typés pour les résultats d'extraction (élimine Map<String,Object> + casts unsafe)
	public record SliceData(float[][] data, double[] latitudes, double[] longitudes) {}
	public record AnimationData(List<float[][]> frames, double[] latitudes, double[] longitudes) {}
	public record ProfileData(List<Float> values, double[] altitudes, double actualLat, double actualLon) {}
	public record CrossSectionData(float[][] data, double[] altitudes, double[] horizontalCoords, double fixedValue) {}
	public record WindFieldData(double[] lats, double[] lons, double[] u, double[] v) {}

	// Noms de coordonnées et variables standardisés
	private static final String COORD_LAT = "lat";
	private static final String COORD_LON = "lon";
	private static final String VAR_UU    = "UU";
	private static final String VAR_VV    = "VV";

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
			assertPathSafe(filePath, pathConfig.getMeanPath());
		} else {
			assertPathSafe(filePath, pathConfig.getIndividualPath());
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
	 * Vérifie qu'un chemin résolu reste bien sous le répertoire autorisé.
	 * Protège contre les attaques par traversée de chemin (ex: "../../etc/passwd").
	 * Utilise normalize() + startsWith() (pas toRealPath() qui échoue sur UNC/réseau).
	 *
	 * @param file        chemin du fichier résolu
	 * @param allowedRoot répertoire racine autorisé
	 * @throws NetCDFException si le chemin sort du répertoire autorisé
	 */
	private void assertPathSafe(Path file, Path allowedRoot) {
		Path normalizedFile = file.normalize().toAbsolutePath();
		Path normalizedRoot = allowedRoot.normalize().toAbsolutePath();
		if (!normalizedFile.startsWith(normalizedRoot)) {
			log.error("Path traversal bloqué : {} hors de {}", normalizedFile, normalizedRoot);
			throw new NetCDFException("error.path.traversal", normalizedFile.toString());
		}
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
	 * Extrait une slice 2D avec les coordonnées géo.
	 * Lecture partielle : {@code 1×1×nLat×nLon} au lieu du tenseur complet.
	 *
	 * @return SliceData record typé (élimine les casts unsafe)
	 */
	public SliceData extractSlice2DWithCoords(String filename, String variableName,
			int timeIndex, int altitudeIndex) {

		log.info("Extraction slice 2D avec coordonnées : fichier={}, variable={}, time={}, altitude={}",
				filename, variableName, timeIndex, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("error.netcdf.variable.not.found", variableName);
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

			double[] latitudes  = extractCoordinates(ncfile, COORD_LAT);
			double[] longitudes = extractCoordinates(ncfile, COORD_LON);

			log.info("Slice 2D extraite avec coordonnées : {}x{} (surface={})", nLat, nLon, isSurface);
			return new SliceData(slice, latitudes, longitudes);

		} catch (IOException e) {
			throw new NetCDFException(e, "error.netcdf.read.slice", filename);
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
				throw new NetCDFException("error.netcdf.variable.not.found", variableName);
			}

			double[] latitudes  = extractCoordinates(ncfile, COORD_LAT);
			double[] longitudes = extractCoordinates(ncfile, COORD_LON);
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

		} catch (IOException e) {
			throw new NetCDFException(e, "error.netcdf.read.timeseries", filename);
		}
	}

	/**
	 * Extrait 48 frames pour animation diurne.
	 * Lecture partielle : {@code nTime×1×nLat×nLon} (variables 4D).
	 *
	 * @return AnimationData record typé
	 */
	public AnimationData extractAnimationFrames(String filename, String variableName, int altitudeIndex) {

		log.info("Extraction frames animation : fichier={}, variable={}, altitude={}",
				filename, variableName, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("error.netcdf.variable.not.found", variableName);
			}

			int[]   varShape  = variable.getShape();
			boolean isSurface = (varShape.length == 3);
			int     nTime     = varShape[0];
			int     nLat      = isSurface ? varShape[1] : varShape[2];
			int     nLon      = isSurface ? varShape[2] : varShape[3];

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

			double[] latitudes  = extractCoordinates(ncfile, COORD_LAT);
			double[] longitudes = extractCoordinates(ncfile, COORD_LON);

			log.debug("Frames animation extraites : {} frames de {}x{} (surface={})",
					nTime, nLat, nLon, isSurface);

			return new AnimationData(frames, latitudes, longitudes);

		} catch (IOException e) {
			throw new NetCDFException(e, "error.netcdf.read.animation", filename);
		}
	}

	/**
	 * Extrait un profil vertical (toutes les altitudes) en un point et un instant.
	 * Lecture partielle : {@code 1×nAlt×1×1} — une seule colonne atmosphérique.
	 * Réservé aux variables 4D.
	 *
	 * @return ProfileData record typé
	 */
	public ProfileData extractVerticalProfile(String filename, String variableName,
			int timeIndex, double latitude, double longitude) {

		log.info("Extraction profil vertical : fichier={}, variable={}, time={}, lat={}, lon={}",
				filename, variableName, timeIndex, latitude, longitude);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("error.netcdf.variable.not.found", variableName);
			}

			int[] varShape = variable.getShape();
			if (varShape.length == 3) {
				throw new NetCDFException("error.netcdf.surface.no.profile", variableName);
			}

			double[] latitudes  = extractCoordinates(ncfile, COORD_LAT);
			double[] longitudes = extractCoordinates(ncfile, COORD_LON);
			int      latIdx     = findNearestIndex(latitudes,  latitude);
			int      lonIdx     = findNearestIndex(longitudes, longitude);

			String   altDimName = variable.getDimension(1).getShortName();
			double[] altCoords  = extractCoordinates(ncfile, altDimName);
			int      nAlt       = varShape[1];

			ucar.ma2.Array data  = readSection(variable,
				new int[]{timeIndex, 0, latIdx, lonIdx}, new int[]{1, nAlt, 1, 1});
			ucar.ma2.Index index = data.getIndex();

			List<Float> values = new ArrayList<>(nAlt);
			for (int a = 0; a < nAlt; a++) {
				values.add(data.getFloat(index.set(0, a, 0, 0)));
			}

			log.info("Profil vertical extrait : {} niveaux", nAlt);
			return new ProfileData(values, altCoords, latitudes[latIdx], longitudes[lonIdx]);

		} catch (IOException e) {
			throw new NetCDFException(e, "error.netcdf.read.profile", filename);
		}
	}

	/**
	 * Extrait une coupe verticale (méridionale ou zonale) en un instant.
	 * Lecture partielle : méridionale {@code 1×nAlt×nLat×1}, zonale {@code 1×nAlt×1×nLon}.
	 * Réservé aux variables 4D.
	 *
	 * @return CrossSectionData record typé
	 */
	public CrossSectionData extractCrossSection(String filename, String variableName,
			int timeIndex, String type, double fixedCoordinate) {

		log.info("Extraction coupe verticale : fichier={}, variable={}, time={}, type={}, fixed={}",
				filename, variableName, timeIndex, type, fixedCoordinate);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable variable = ncfile.findVariable(variableName);
			if (variable == null) {
				throw new NetCDFException("error.netcdf.variable.not.found", variableName);
			}

			int[] varShape = variable.getShape();
			if (varShape.length == 3) {
				throw new NetCDFException("error.netcdf.surface.no.crosssection", variableName);
			}

			double[] latitudes  = extractCoordinates(ncfile, COORD_LAT);
			double[] longitudes = extractCoordinates(ncfile, COORD_LON);
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
				throw new NetCDFException("error.netcdf.crosssection.type", type);
			}

			double[] hCoords = new double[horizontalCoords.length];
			for (int i = 0; i < horizontalCoords.length; i++) hCoords[i] = horizontalCoords[i];

			log.info("Coupe verticale {} extraite : {}x{}", type, section.length, section[0].length);
			return new CrossSectionData(section, altCoords, hCoords, actualFixed);

		} catch (IOException e) {
			throw new NetCDFException(e, "error.netcdf.read.crosssection", filename);
		}
	}

	/**
	 * Extrait un champ de vent (UU, VV) subsamplé à un instant et une altitude.
	 * Lecture partielle : {@code 1×1×nLat×nLon} pour UU et VV.
	 * Si UU ou VV est absent, retourne un WindFieldData avec tableaux vides.
	 *
	 * @return WindFieldData record typé
	 */
	public WindFieldData extractWindField(String filename, int timeIndex, int altitudeIndex) {

		log.info("Extraction champ de vent : fichier={}, time={}, altitude={}", filename, timeIndex, altitudeIndex);

		try (NetcdfFile ncfile = openMeanFile(filename)) {
			ucar.nc2.Variable uuVar = ncfile.findVariable(VAR_UU);
			ucar.nc2.Variable vvVar = ncfile.findVariable(VAR_VV);

			if (uuVar == null || vvVar == null) {
				log.warn("Variables UU ou VV absentes dans {} — champ de vent non disponible", filename);
				return new WindFieldData(new double[0], new double[0], new double[0], new double[0]);
			}

			double[] latCoords = extractCoordinates(ncfile, COORD_LAT);
			double[] lonCoords = extractCoordinates(ncfile, COORD_LON);
			int      nLat      = latCoords.length;
			int      nLon      = lonCoords.length;

			ucar.ma2.Array uData = readSection(uuVar,
				new int[]{timeIndex, altitudeIndex, 0, 0}, new int[]{1, 1, nLat, nLon});
			ucar.ma2.Array vData = readSection(vvVar,
				new int[]{timeIndex, altitudeIndex, 0, 0}, new int[]{1, 1, nLat, nLon});

			ucar.ma2.Index uIdx = uData.getIndex();
			ucar.ma2.Index vIdx = vData.getIndex();

			int step = 3;
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

			log.info("Champ de vent extrait : {} vecteurs ({}x{} grid, step={})", k, cLat, cLon, step);
			return new WindFieldData(latsArr, lonsArr, uArr, vArr);

		} catch (IOException e) {
			throw new NetCDFException(e, "error.netcdf.read.wind", filename);
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
				throw new NetCDFException("error.netcdf.variable.not.in.file", variableName, filename);
			}

			int[] shape = variable.getShape();
			if (shape.length == 3) {
				log.debug("Variable de surface, pas d'altitude");
				return null;
			}

			String   altDimName = variable.getDimension(1).getShortName();
			double[] altCoords  = extractCoordinates(ncfile, altDimName);
			if (altitudeIndex >= altCoords.length) {
				log.warn("Index d'altitude hors bornes : {} >= {}", altitudeIndex, altCoords.length);
				return null;
			}

			double value = altCoords[altitudeIndex];
			log.debug("Altitude réelle : index {} → {} km", altitudeIndex, value);
			return value;

		} catch (IOException e) {
			throw new NetCDFException(e, "error.netcdf.read.altitude", filename);
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
			throw new NetCDFException(e, "error.netcdf.read.section", variable.getShortName());
		} catch (ucar.ma2.InvalidRangeException e) {
			throw new NetCDFException(e, "error.netcdf.section.out.of.range",
				variable.getShortName(), Arrays.toString(origin), Arrays.toString(shape));
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
			throw new NetCDFException("error.netcdf.coordinates.not.found");
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
	 * @return tableau des valeurs (jamais null)
	 * @throws NetCDFException si la variable coordonnée est absente
	 */
	private double[] extractCoordinates(NetcdfFile ncfile, String coordName) throws IOException {
		ucar.nc2.Variable coordVar = ncfile.findVariable(coordName);
		if (coordVar == null) {
			throw new NetCDFException("error.netcdf.coordinates.not.found", coordName);
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
