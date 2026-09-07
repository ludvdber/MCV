package com.mars.visualizer.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

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
	 * @return le contenu complet du fichier .nc
	 */
	public byte[] writeSliceNetCDF(String variableName, VariableMetadata meta,
			double[] latitudes, double[] longitudes, float[][] data) throws IOException {

		int nLat = latitudes.length;
		int nLon = longitudes.length;

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
		writeAttributes(baos, List.of(
				new Attribut("Conventions", NC_CHAR, "CF-1.8"),
				new Attribut("title", NC_CHAR, "GEM-Mars slice exported by Mars Climate Viewer"),
				new Attribut("source", NC_CHAR, "Mars Climate Viewer - GEM-Mars export")));

		// --- Variables ---
		writeInt(baos, NC_VARIABLE);
		writeInt(baos, 3);

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

		int dataOffsetPos = writeVariableHeader(baos, variableName, new int[]{0, 1},
				nLat * nLon * 4, attributsDeLaVariable(variableName, meta));

		// === Section des données ===
		padTo4(baos);

		int latOffset = baos.size();
		for (double lat : latitudes) writeFloat(baos, (float) lat);
		padTo4(baos);

		int lonOffset = baos.size();
		for (double lon : longitudes) writeFloat(baos, (float) lon);
		padTo4(baos);

		int dataOffset = baos.size();
		for (float[] row : data) {
			for (float v : row) writeFloat(baos, v);
		}
		padTo4(baos);

		byte[] result = baos.toByteArray();
		patchInt(result, latOffsetPos, latOffset);
		patchInt(result, lonOffsetPos, lonOffset);
		patchInt(result, dataOffsetPos, dataOffset);

		log.info("Export NetCDF : {} [{} x {}] units={} = {} octets",
				variableName, nLat, nLon, meta.units(), result.length);
		return result;
	}

	/**
	 * Attributs de la variable exportée. {@code standard_name} n'est écrit que
	 * si le fichier source en portait un : un {@code standard_name} inventé est
	 * pire qu'absent, la liste CF est normative.
	 *
	 * <p>{@code _FillValue} déclare le NaN utilisé pour les cellules masquées.
	 * Sans lui, un outil CF traite ces cellules comme des mesures.
	 */
	private List<Attribut> attributsDeLaVariable(String variableName, VariableMetadata meta) {
		List<Attribut> attrs = new ArrayList<>();
		attrs.add(new Attribut("units", NC_CHAR, meta.units()));
		attrs.add(new Attribut("long_name", NC_CHAR,
				meta.longName() != null && !meta.longName().isBlank() ? meta.longName() : variableName));
		if (meta.standardName() != null && !meta.standardName().isBlank()) {
			attrs.add(new Attribut("standard_name", NC_CHAR, meta.standardName()));
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
	 * Remplace tout caractère non-ASCII par « ? ». NC_CHAR vaut un octet par
	 * caractère : laisser passer de l'UTF-8 fabrique du charabia côté lecteur.
	 */
	private static String asciiSeul(String s) {
		if (s == null) return "";
		StringBuilder sb = new StringBuilder(s.length());
		for (int i = 0; i < s.length(); i++) {
			char c = s.charAt(i);
			sb.append(c < 128 ? c : '?');
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
