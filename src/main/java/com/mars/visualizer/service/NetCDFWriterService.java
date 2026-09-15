package com.mars.visualizer.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.mars.visualizer.dto.internal.CoordonneeScalaire;
import com.mars.visualizer.dto.internal.ProvenanceTranche;
import com.mars.visualizer.dto.internal.VariableMetadata;

import lombok.extern.slf4j.Slf4j;

/**
 * Écriture de fichiers NetCDF3 « Classic » en binaire.
 * Produit un .nc minimal contenant une variable 2D et ses axes lat/lon.
 *
 * <p>L'écriture est faite octet à octet selon la spécification NetCDF3 plutôt
 * qu'avec une bibliothèque, pour ne pas dépendre des binaires natifs HDF5
 * qu'exige netcdf4.
 *
 * <p><b>Le fichier se déclare {@code Conventions = CF-1.8}, il doit donc en
 * respecter les règles.</b> Les attributs {@code units}, {@code standard_name}
 * et {@code long_name} sont recopiés du fichier GEM-Mars source ; ils ne sont
 * pas inventés ici. L'export écrivait auparavant la chaîne littérale
 * {@code "see_source"} dans {@code units} et le code de la variable dans
 * {@code long_name} : le fichier annonçait une convention qu'il ne tenait pas,
 * et aucun outil CF (xarray, Panoply, cfchecker) ne pouvait interpréter l'unité.
 *
 * <p>Les attributs texte restent en ASCII. NC_CHAR est un type d'un octet par
 * caractère dans le modèle NetCDF3 : un caractère non-ASCII y occupe plusieurs
 * octets et ressort en charabia dans tout lecteur qui suppose du Latin-1.
 */
@Service
@Slf4j
public class NetCDFWriterService {

	/** NC_BYTE=1, NC_CHAR=2, NC_SHORT=3, NC_INT=4, NC_FLOAT=5, NC_DOUBLE=6 */
	private static final int NC_CHAR = 2;
	private static final int NC_FLOAT = 5;

	private static final int NC_DIMENSION = 0x0A;
	private static final int NC_VARIABLE = 0x0B;
	private static final int NC_ATTRIBUTE = 0x0C;

	/** Un attribut NetCDF : son nom, son type, et sa valeur déjà encodée. */
	private record Attribut(String nom, int type, Object valeur) {}

	/**
	 * Crée un fichier NetCDF3 Classic contenant une grille 2D.
	 *
	 * @param variableName nom de la variable (ex. « TT »)
	 * @param meta         unité et noms CF lus dans le fichier source
	 * @param latitudes    axe des latitudes
	 * @param longitudes   axe des longitudes
	 * @param data         grille [lat][lon]
	 * @param provenance   d'où vient la tranche ; jamais {@code null}, au pire
	 *                     {@link ProvenanceTranche#inconnue()}
	 * @return le contenu complet du fichier .nc
	 */
	public byte[] writeSliceNetCDF(String variableName, VariableMetadata meta,
			double[] latitudes, double[] longitudes, float[][] data,
			ProvenanceTranche provenance) throws IOException {

		int nLat = latitudes.length;
		int nLon = longitudes.length;
		List<CoordonneeScalaire> scalaires = provenance == null
				? List.of() : provenance.coordonnees();

		ByteArrayOutputStream baos = new ByteArrayOutputStream();

		// === En-tête NetCDF3 Classic ===

		baos.write(new byte[]{'C', 'D', 'F', 0x01});  // magie + version classique
		writeInt(baos, 0);                            // aucun enregistrement (pas de dimension illimitée)

		// --- Dimensions ---
		writeInt(baos, NC_DIMENSION);
		writeInt(baos, 2);
		writeString(baos, "lat");
		writeInt(baos, nLat);
		writeString(baos, "lon");
		writeInt(baos, nLon);

		// --- Attributs globaux ---
		writeAttributes(baos, attributsGlobaux(variableName, provenance));

		// --- Variables ---
		// lat, lon, les coordonnées scalaires de provenance, puis la grille.
		writeInt(baos, NC_VARIABLE);
		writeInt(baos, 3 + scalaires.size());

		int latOffsetPos = writeVariableHeader(baos, "lat", new int[]{0}, nLat * 4, List.of(
				new Attribut("units", NC_CHAR, "degrees_north"),
				new Attribut("standard_name", NC_CHAR, "latitude"),
				new Attribut("long_name", NC_CHAR, "latitude"),
				new Attribut("axis", NC_CHAR, "Y")));

		int lonOffsetPos = writeVariableHeader(baos, "lon", new int[]{1}, nLon * 4, List.of(
				new Attribut("units", NC_CHAR, "degrees_east"),
				new Attribut("standard_name", NC_CHAR, "longitude"),
				new Attribut("long_name", NC_CHAR, "longitude"),
				new Attribut("axis", NC_CHAR, "X")));

		// Une coordonnée scalaire est une variable de rang 0 : aucune dimension,
		// quatre octets de données. C'est la forme que CF-1.8 (§ 5.7) prévoit
		// pour dire « cette grille a été prise à cet instant, à ce niveau ».
		int[] scalaireOffsetPos = new int[scalaires.size()];
		for (int i = 0; i < scalaires.size(); i++) {
			CoordonneeScalaire c = scalaires.get(i);
			scalaireOffsetPos[i] = writeVariableHeader(baos, c.nom(), new int[]{}, 4,
					attributsDeLaCoordonnee(c));
		}

		int dataOffsetPos = writeVariableHeader(baos, variableName, new int[]{0, 1},
				nLat * nLon * 4, attributsDeLaVariable(variableName, meta, scalaires));

		// === Section des données ===
		padTo4(baos);

		int latOffset = baos.size();
		for (double lat : latitudes) writeFloat(baos, (float) lat);
		padTo4(baos);

		int lonOffset = baos.size();
		for (double lon : longitudes) writeFloat(baos, (float) lon);
		padTo4(baos);

		int[] scalaireOffset = new int[scalaires.size()];
		for (int i = 0; i < scalaires.size(); i++) {
			scalaireOffset[i] = baos.size();
			writeFloat(baos, (float) scalaires.get(i).valeur());
			padTo4(baos);
		}

		int dataOffset = baos.size();
		for (float[] row : data) {
			for (float v : row) writeFloat(baos, v);
		}
		padTo4(baos);

		byte[] result = baos.toByteArray();
		patchInt(result, latOffsetPos, latOffset);
		patchInt(result, lonOffsetPos, lonOffset);
		for (int i = 0; i < scalaires.size(); i++) {
			patchInt(result, scalaireOffsetPos[i], scalaireOffset[i]);
		}
		patchInt(result, dataOffsetPos, dataOffset);

		log.info("Export NetCDF : {} [{} x {}] units={} jeu={} = {} octets",
				variableName, nLat, nLon, meta.units(),
				provenance == null ? "?" : provenance.datasetId(), result.length);
		return result;
	}

	/**
	 * Attributs globaux, provenance comprise.
	 *
	 * <p>{@code dataset_id} et {@code history} sont ce qui distingue deux
	 * tranches. Sans eux, {@code TT} au pas 0 et à l'altitude 0 sortait à
	 * l'identique qu'il vienne du printemps nord ou de l'été sud.
	 */
	private List<Attribut> attributsGlobaux(String variableName, ProvenanceTranche p) {
		List<Attribut> attrs = new ArrayList<>();
		attrs.add(new Attribut("Conventions", NC_CHAR, "CF-1.8"));
		attrs.add(new Attribut("title", NC_CHAR, "GEM-Mars slice exported by Mars Climate Viewer"));
		attrs.add(new Attribut("source", NC_CHAR, "Mars Climate Viewer - GEM-Mars export"));
		if (p != null && p.datasetId() != null) {
			attrs.add(new Attribut("dataset_id", NC_CHAR, p.datasetId()));
			StringBuilder h = new StringBuilder("Slice extracted from ").append(p.datasetId())
					.append(" by Mars Climate Viewer: variable=").append(variableName)
					.append(", time_index=").append(p.timeIndex());
			if (p.altitudeIndex() != null) {
				h.append(", altitude_index=").append(p.altitudeIndex());
			}
			// Volontairement sans horodatage : deux exports du meme extrait
			// doivent donner deux fichiers identiques, sinon rien ne peut plus
			// etre compare octet a octet.
			attrs.add(new Attribut("history", NC_CHAR, h.toString()));
		}
		return attrs;
	}

	/** Attributs d'une coordonnée scalaire, recopiés du fichier source. */
	private List<Attribut> attributsDeLaCoordonnee(CoordonneeScalaire c) {
		List<Attribut> attrs = new ArrayList<>();
		attrs.add(new Attribut("units", NC_CHAR, c.meta().units()));
		if (c.meta().longName() != null && !c.meta().longName().isBlank()) {
			attrs.add(new Attribut("long_name", NC_CHAR, c.meta().longName()));
		}
		if (c.meta().standardName() != null && !c.meta().standardName().isBlank()) {
			attrs.add(new Attribut("standard_name", NC_CHAR, c.meta().standardName()));
		}
		if (c.positive() != null && !c.positive().isBlank()) {
			attrs.add(new Attribut("positive", NC_CHAR, c.positive()));
		}
		if (c.axe() != null && !c.axe().isBlank()) {
			attrs.add(new Attribut("axis", NC_CHAR, c.axe()));
		}
		return attrs;
	}

	/**
	 * Attributs de la variable exportée. {@code standard_name} n'est écrit que
	 * si le fichier source en portait un : un {@code standard_name} inventé est
	 * pire qu'absent, la liste CF est normative.
	 *
	 * <p>{@code _FillValue} déclare le NaN utilisé pour les cellules masquées.
	 * Sans lui, un outil CF traite ces cellules comme des mesures.
	 */
	private List<Attribut> attributsDeLaVariable(String variableName, VariableMetadata meta,
			List<CoordonneeScalaire> scalaires) {
		List<Attribut> attrs = new ArrayList<>();
		attrs.add(new Attribut("units", NC_CHAR, meta.units()));
		attrs.add(new Attribut("long_name", NC_CHAR,
				meta.longName() != null && !meta.longName().isBlank() ? meta.longName() : variableName));
		if (meta.standardName() != null && !meta.standardName().isBlank()) {
			attrs.add(new Attribut("standard_name", NC_CHAR, meta.standardName()));
		}
		// CF-1.8 § 5.7 : c'est « coordinates » qui rattache les coordonnées
		// scalaires à la grille. Sans lui, elles restent des variables isolées
		// que rien ne relie à la mesure.
		if (!scalaires.isEmpty()) {
			attrs.add(new Attribut("coordinates", NC_CHAR,
					scalaires.stream().map(CoordonneeScalaire::nom).collect(Collectors.joining(" "))));
		}
		attrs.add(new Attribut("_FillValue", NC_FLOAT, Float.NaN));
		return attrs;
	}

	/**
	 * Écrit l'en-tête d'une variable et retourne la POSITION du champ
	 * {@code begin}, à corriger une fois la taille de l'en-tête connue.
	 */
	private int writeVariableHeader(ByteArrayOutputStream baos, String nom, int[] dimIds,
			int vsize, List<Attribut> attributs) throws IOException {
		writeString(baos, nom);
		writeInt(baos, dimIds.length);
		for (int d : dimIds) writeInt(baos, d);
		writeAttributes(baos, attributs);
		writeInt(baos, NC_FLOAT);
		writeInt(baos, vsize);
		int positionBegin = baos.size();
		writeInt(baos, 0); // réservé, corrigé par patchInt
		return positionBegin;
	}

	/** Liste d'attributs, ou le marqueur ABSENT (deux zéros) si elle est vide. */
	private void writeAttributes(ByteArrayOutputStream baos, List<Attribut> attributs) throws IOException {
		if (attributs.isEmpty()) {
			writeInt(baos, 0);
			writeInt(baos, 0);
			return;
		}
		writeInt(baos, NC_ATTRIBUTE);
		writeInt(baos, attributs.size());
		for (Attribut a : attributs) {
			writeString(baos, a.nom());
			writeInt(baos, a.type());
			if (a.type() == NC_CHAR) {
				writeString(baos, asciiSeul((String) a.valeur()));
			} else {
				writeInt(baos, 1); // un seul élément
				writeFloat(baos, (Float) a.valeur());
			}
		}
	}

	/**
	 * Équivalents ASCII des symboles qui portent un sens scientifique.
	 *
	 * <p>« µ » est le cas qui a motivé cette table : les trois variables de
	 * poussière déclarent {@code Dust mixing ratio (0.1 µm)} dans le fichier
	 * source, et un remplacement aveugle en « ? » donnait
	 * {@code (0.1 ?m)}, c'est-à-dire une unité inconnue dans le seul attribut
	 * qui dit à un scientifique de quelle grandeur il s'agit. « um » est la
	 * graphie ASCII usuelle du micromètre (celle d'UDUNITS), elle conserve
	 * l'information au lieu de la détruire.
	 */
	private static final Map<Character, String> EQUIVALENTS_ASCII = Map.of(
			'µ', "u",    // MICRO SIGN
			'μ', "u",    // GREEK SMALL LETTER MU, même sens dans une unité
			'°', "deg",  // DEGREE SIGN
			'²', "2",    // exposant carré
			'³', "3",    // exposant cube
			'×', "x",    // MULTIPLICATION SIGN
			'−', "-",    // MINUS SIGN typographique
			'–', "-",    // tiret demi-cadratin
			'—', "-");   // tiret cadratin

	/**
	 * Réduit une chaîne à de l'ASCII. NC_CHAR vaut un octet par caractère dans
	 * le modèle NetCDF3 : laisser passer de l'UTF-8 fabrique du charabia côté
	 * lecteur, la règle « ASCII seulement » est donc juste.
	 *
	 * <p>Ce qui ne l'était pas, c'est le caractère de remplacement. En trois
	 * temps, du plus fidèle au moins fidèle : les accents sont retirés par
	 * décomposition Unicode (« é » donne « e »), les symboles scientifiques
	 * passent par {@link #EQUIVALENTS_ASCII}, et « ? » ne sert plus que de
	 * dernier recours pour ce qui n'a réellement aucune écriture ASCII.
	 *
	 * <p>Note : la décomposition NFD ne touche pas « µ », qui n'est pas une
	 * lettre accentuée mais un symbole ; c'est la table qui s'en charge.
	 */
	static String asciiSeul(String s) {
		if (s == null) return "";
		String decompose = Normalizer.normalize(s, Normalizer.Form.NFD);
		StringBuilder sb = new StringBuilder(s.length());
		for (int i = 0; i < decompose.length(); i++) {
			char c = decompose.charAt(i);
			if (c < 128) {
				sb.append(c);
			} else if (Character.getType(c) == Character.NON_SPACING_MARK) {
				// Accent isolé par la décomposition : la lettre de base est
				// déjà écrite, la marque n'a rien à faire dans un octet ASCII.
				continue;
			} else {
				sb.append(EQUIVALENTS_ASCII.getOrDefault(c, "?"));
			}
		}
		return sb.toString();
	}

	private void writeInt(ByteArrayOutputStream baos, int val) {
		ByteBuffer buf = ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putInt(val);
		baos.write(buf.array(), 0, 4);
	}

	private void writeFloat(ByteArrayOutputStream baos, float val) {
		ByteBuffer buf = ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putFloat(val);
		baos.write(buf.array(), 0, 4);
	}

	private void writeString(ByteArrayOutputStream baos, String str) {
		byte[] bytes = str.getBytes(java.nio.charset.StandardCharsets.UTF_8);
		writeInt(baos, bytes.length);
		baos.write(bytes, 0, bytes.length);
		int pad = (4 - (bytes.length % 4)) % 4;
		for (int i = 0; i < pad; i++) baos.write(0);
	}

	private void padTo4(ByteArrayOutputStream baos) {
		int pad = (4 - (baos.size() % 4)) % 4;
		for (int i = 0; i < pad; i++) baos.write(0);
	}

	private void patchInt(byte[] data, int offset, int value) {
		data[offset]     = (byte) (value >> 24);
		data[offset + 1] = (byte) (value >> 16);
		data[offset + 2] = (byte) (value >> 8);
		data[offset + 3] = (byte) value;
	}
}
