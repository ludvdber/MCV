package com.mars.visualizer.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

/**
 * Service for writing NetCDF3 Classic binary format.
 * Produces minimal .nc files containing a single 2D variable
 * with lat/lon coordinate arrays.
 *
 * Uses raw binary output (NetCDF3 Classic spec) to avoid
 * dependency on native HDF5 libraries required by netcdf4.
 */
@Service
@Slf4j
public class NetCDFWriterService {

	/**
	 * Creates a NetCDF3 Classic binary file containing a 2D grid.
	 *
	 * @param variableName Name of the variable (e.g., "TT")
	 * @param unit         Unit string (e.g., "K")
	 * @param latitudes    Latitude coordinate array
	 * @param longitudes   Longitude coordinate array
	 * @param data         2D float array [lat][lon]
	 * @return byte array of the complete .nc file
	 */
	public byte[] writeSliceNetCDF(String variableName, String unit,
			double[] latitudes, double[] longitudes, float[][] data) throws IOException {

		int nLat = latitudes.length;
		int nLon = longitudes.length;

		ByteArrayOutputStream baos = new ByteArrayOutputStream();

		// === NetCDF3 Classic Header ===

		// Magic: "CDF\x01" (classic format)
		baos.write(new byte[]{'C', 'D', 'F', 0x01});

		// Number of records (0 = no unlimited dimension)
		writeInt(baos, 0);

		// --- Dimension list ---
		writeInt(baos, 0x0000000A); // NC_DIMENSION tag
		writeInt(baos, 2);          // 2 dimensions

		// dim 0: lat
		writeString(baos, "lat");
		writeInt(baos, nLat);

		// dim 1: lon
		writeString(baos, "lon");
		writeInt(baos, nLon);

		// --- Global attributes ---
		writeInt(baos, 0x0000000C); // NC_ATTRIBUTE tag
		writeInt(baos, 2);          // 2 global attrs

		// Conventions
		writeString(baos, "Conventions");
		writeInt(baos, 2); // NC_CHAR
		writeString(baos, "CF-1.8");

		// Source
		writeString(baos, "source");
		writeInt(baos, 2); // NC_CHAR
		writeString(baos, "Mars Climate Viewer — GEM-Mars export");

		// --- Variable list ---
		writeInt(baos, 0x0000000B); // NC_VARIABLE tag
		writeInt(baos, 3);          // 3 variables: lat, lon, data

		// Variable: lat (1D, float)
		writeString(baos, "lat");
		writeInt(baos, 1);     // 1 dimension
		writeInt(baos, 0);     // dim index 0
		writeInt(baos, 0x0000000C); // NC_ATTRIBUTE
		writeInt(baos, 2);     // 2 attrs
		writeString(baos, "units");
		writeInt(baos, 2); writeString(baos, "degrees_north");
		writeString(baos, "long_name");
		writeInt(baos, 2); writeString(baos, "latitude");
		writeInt(baos, 5);     // NC_FLOAT type
		writeInt(baos, nLat * 4); // vsize
		// offset placeholder — will calculate later
		int latOffsetPos = baos.size();
		writeInt(baos, 0); // placeholder

		// Variable: lon (1D, float)
		writeString(baos, "lon");
		writeInt(baos, 1);
		writeInt(baos, 1);     // dim index 1
		writeInt(baos, 0x0000000C);
		writeInt(baos, 2);
		writeString(baos, "units");
		writeInt(baos, 2); writeString(baos, "degrees_east");
		writeString(baos, "long_name");
		writeInt(baos, 2); writeString(baos, "longitude");
		writeInt(baos, 5);     // NC_FLOAT
		writeInt(baos, nLon * 4);
		int lonOffsetPos = baos.size();
		writeInt(baos, 0);

		// Variable: data (2D, float)
		writeString(baos, variableName);
		writeInt(baos, 2);     // 2 dimensions
		writeInt(baos, 0);     // dim 0 = lat
		writeInt(baos, 1);     // dim 1 = lon
		writeInt(baos, 0x0000000C);
		writeInt(baos, 2);
		writeString(baos, "units");
		writeInt(baos, 2); writeString(baos, unit);
		writeString(baos, "long_name");
		writeInt(baos, 2); writeString(baos, variableName);
		writeInt(baos, 5);     // NC_FLOAT
		writeInt(baos, nLat * nLon * 4);
		int dataOffsetPos = baos.size();
		writeInt(baos, 0);

		// === Data Section ===
		byte[] result = baos.toByteArray();
		int headerSize = result.length;

		// Pad header to 4-byte boundary
		int padding = (4 - (headerSize % 4)) % 4;
		baos.write(new byte[padding]);

		int latOffset = baos.size();
		// Write lat values
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

		// Patch offsets
		result = baos.toByteArray();
		patchInt(result, latOffsetPos, latOffset);
		patchInt(result, lonOffsetPos, lonOffset);
		patchInt(result, dataOffsetPos, dataOffset);

		log.info("NetCDF export: {} [{} x {}] = {} bytes", variableName, nLat, nLon, result.length);
		return result;
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
		// Pad to 4-byte boundary
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
