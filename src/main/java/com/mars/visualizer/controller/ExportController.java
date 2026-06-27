package com.mars.visualizer.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.internal.*;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.NetCDFWriterService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.CSVBuilder;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.MarsConstants;

import lombok.extern.slf4j.Slf4j;

/**
 * Controller REST pour l'export CSV de toutes les visualisations.
 */
@RestController
@RequestMapping("/api/export")
@Slf4j
public class ExportController extends AbstractDataController {

	private static final MediaType TEXT_CSV = MediaType.parseMediaType("text/csv");
	private static final MediaType NETCDF = MediaType.parseMediaType("application/x-netcdf");

	private final NetCDFReaderService netcdfService;
	private final NetCDFWriterService netcdfWriter;

	public ExportController(NetCDFReaderService netcdfService,
			NetCDFWriterService netcdfWriter,
			ValidationService validationService,
			DatasetResolver datasetResolver) {
		super(validationService, datasetResolver);
		this.netcdfService = netcdfService;
		this.netcdfWriter = netcdfWriter;
	}

	@GetMapping("/csv/slice")
	public ResponseEntity<String> exportSliceCSV(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam(defaultValue = "0") int altitude) {

		var resolved = resolveDataset(dataset, time);
		validationService.validateTimestep(resolved.time());
		validationService.validateAltitude(altitude);

		SliceData slice = netcdfService.extractSlice2DWithCoords(resolved.filename(), variable, resolved.time(), altitude);
		String csv = CSVBuilder.grid2D(slice.data(), slice.latitudes(), slice.longitudes(),
				"latitude", "longitude", "value");

		return csvResponse(csv, String.format("slice_%s_%s_t%d_alt%d.csv", dataset, variable, resolved.time(), altitude));
	}

	@GetMapping("/csv/timeseries")
	public ResponseEntity<String> exportTimeSeriesCSV(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam double latitude,
			@RequestParam double longitude,
			@RequestParam(defaultValue = "0") int altitude) {

		requireMeanDataset(dataset, "error.individual.export.timeseries");
		String ncFile = datasetResolver.resolveFilename(dataset);
		validationService.validateLatitude(latitude);
		validationService.validateLongitude(longitude);
		validationService.validateAltitude(altitude);

		var values = netcdfService.extractTimeSeries(ncFile, variable, latitude, longitude, altitude);
		String csv = CSVBuilder.series(values, "timestep", "value");

		return csvResponse(csv, String.format("timeseries_%s_%s_lat%s_lon%s_alt%d.csv",
				dataset, variable, datasetResolver.formatCoord(latitude),
				datasetResolver.formatCoord(longitude), altitude));
	}

	@GetMapping("/csv/profile")
	public ResponseEntity<String> exportProfileCSV(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam double latitude,
			@RequestParam double longitude) {

		var resolved = resolveDataset(dataset, time);
		validationService.validateTimestep(resolved.time());
		validationService.validateLatitude(latitude);
		validationService.validateLongitude(longitude);

		ProfileData profile = netcdfService.extractVerticalProfile(resolved.filename(), variable, resolved.time(), latitude, longitude);
		String csv = CSVBuilder.profile(profile.values(), profile.altitudes());

		return csvResponse(csv, String.format("profile_%s_%s_t%d_lat%s_lon%s.csv",
				dataset, variable, resolved.time(),
				datasetResolver.formatCoord(latitude), datasetResolver.formatCoord(longitude)));
	}

	@GetMapping("/csv/crosssection")
	public ResponseEntity<String> exportCrossSectionCSV(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam String type,
			@RequestParam double fixedCoordinate) {

		var resolved = resolveDataset(dataset, time);
		validationService.validateTimestep(resolved.time());
		validateCrossSectionType(type, fixedCoordinate);

		CrossSectionData cs = netcdfService.extractCrossSection(resolved.filename(), variable, resolved.time(), type, fixedCoordinate);
		String horizLabel = MarsConstants.CROSS_SECTION_MERIDIONAL.equals(type) ? "latitude" : "longitude";
		String csv = CSVBuilder.grid2D(cs.data(), cs.altitudes(), cs.horizontalCoords(),
				"altitude_km", horizLabel, "value");

		return csvResponse(csv, String.format("crosssection_%s_%s_%s_t%d_fixed%s.csv",
				dataset, variable, type, resolved.time(), datasetResolver.formatCoord(fixedCoordinate)));
	}

	@GetMapping("/csv/hovmoller")
	public ResponseEntity<String> exportHovmollerCSV(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int altitude,
			@RequestParam(defaultValue = "latitude") String type) {

		requireMeanDataset(dataset, "error.individual.hovmoller");
		validateHovmollerType(type);
		String filename = datasetResolver.resolveFilename(dataset);
		validationService.validateAltitude(altitude);

		HovmollerData hov = netcdfService.extractHovmoller(filename, variable, altitude, type);
		String spatialLabel = "latitude".equals(type) ? "latitude" : "longitude";
		String csv = CSVBuilder.grid2D(hov.data(), hov.times(), hov.spatialCoords(),
				"time_h", spatialLabel, "value");

		return csvResponse(csv, String.format("hovmoller_%s_%s_%s_alt%d.csv", dataset, variable, type, altitude));
	}

	@GetMapping("/csv/zonalmean")
	public ResponseEntity<String> exportZonalMeanCSV(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time) {

		var resolved = resolveDataset(dataset, time);
		validationService.validateTimestep(resolved.time());

		ZonalMeanData zm = netcdfService.extractZonalMean(resolved.filename(), variable, resolved.time());
		String csv = CSVBuilder.grid2D(zm.data(), zm.altitudes(), zm.latitudes(),
				"altitude_km", "latitude", "value");

		return csvResponse(csv, String.format("zonalmean_%s_%s_t%d.csv", dataset, variable, resolved.time()));
	}

	@GetMapping("/csv/windrose")
	public ResponseEntity<String> exportWindRoseCSV(
			@RequestParam String dataset,
			@RequestParam double latitude,
			@RequestParam double longitude,
			@RequestParam(defaultValue = "49") int altitude) {

		requireMeanDataset(dataset, "error.individual.windrose");
		String filename = datasetResolver.resolveFilename(dataset);
		validationService.validateLatitude(latitude);
		validationService.validateLongitude(longitude);
		validationService.validateAltitude(altitude);

		WindRoseData wr = netcdfService.extractWindRose(filename, latitude, longitude, altitude);
		String csv = CSVBuilder.pairedSeries(wr.uu(), wr.vv(), "timestep", "uu_m_s", "vv_m_s");

		return csvResponse(csv, String.format("windrose_%s_lat%s_lon%s_alt%d.csv",
				dataset, datasetResolver.formatCoord(latitude), datasetResolver.formatCoord(longitude), altitude));
	}

	@GetMapping("/csv/difference")
	public ResponseEntity<String> exportDifferenceCSV(
			@RequestParam String datasetA,
			@RequestParam String datasetB,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam(defaultValue = "0") int altitude) {

		var resolvedA = resolveDataset(datasetA, time);
		var resolvedB = resolveDataset(datasetB, time);
		validationService.validateTimestep(resolvedA.time());
		validationService.validateTimestep(resolvedB.time());
		validationService.validateAltitude(altitude);

		SliceData sliceA = netcdfService.extractSlice2DWithCoords(resolvedA.filename(), variable, resolvedA.time(), altitude);
		SliceData sliceB = netcdfService.extractSlice2DWithCoords(resolvedB.filename(), variable, resolvedB.time(), altitude);
		String csv = CSVBuilder.differenceGrid(sliceA.data(), sliceB.data(), sliceA.latitudes(), sliceA.longitudes());

		return csvResponse(csv, String.format("difference_%s_vs_%s_%s_t%d_alt%d.csv",
				datasetA, datasetB, variable, time, altitude));
	}

	@GetMapping("/csv/temporal-profile")
	public ResponseEntity<String> exportTemporalProfileCSV(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam double latitude,
			@RequestParam double longitude) {

		var resolved = resolveDataset(dataset, 0);
		validationService.validateLatitude(latitude);
		validationService.validateLongitude(longitude);

		TemporalProfileData tp = netcdfService.extractTemporalProfile(resolved.filename(), variable, latitude, longitude);
		int nTime = tp.data()[0].length;
		String csv = CSVBuilder.temporalProfile(tp.data(), tp.altitudes(), nTime);

		return csvResponse(csv, String.format("temporal_profile_%s_lat%s_lon%s.csv",
				variable, datasetResolver.formatCoord(latitude), datasetResolver.formatCoord(longitude)));
	}

	// --- Helpers ---

	private void requireMeanDataset(String dataset, String errorKey) {
		if (datasetResolver.isIndividualDataset(dataset)) {
			throw new ValidationException(errorKey);
		}
	}

	private void validateHovmollerType(String type) {
		if (!MarsConstants.HOVMOLLER_LATITUDE.equals(type) && !MarsConstants.HOVMOLLER_LONGITUDE.equals(type)) {
			throw new ValidationException("error.netcdf.hovmoller.type", type);
		}
	}

	private void validateCrossSectionType(String type, double fixedCoordinate) {
		if (!MarsConstants.CROSS_SECTION_MERIDIONAL.equals(type) && !MarsConstants.CROSS_SECTION_ZONAL.equals(type)) {
			throw new ValidationException("error.netcdf.crosssection.type", type);
		}
		if (MarsConstants.CROSS_SECTION_MERIDIONAL.equals(type)) {
			validationService.validateLongitude(fixedCoordinate);
		} else {
			validationService.validateLatitude(fixedCoordinate);
		}
	}

	// =========================================================================
	// NetCDF export
	// =========================================================================

	@GetMapping("/netcdf/slice")
	public ResponseEntity<byte[]> exportSliceNetCDF(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int time,
			@RequestParam(defaultValue = "0") int altitude) throws java.io.IOException {

		var resolved = resolveDataset(dataset, time);
		validationService.validateTimestep(resolved.time());
		validationService.validateAltitude(altitude);
		SliceData slice = netcdfService.extractSlice2DWithCoords(resolved.filename(), variable, resolved.time(), altitude);
		byte[] ncData = netcdfWriter.writeSliceNetCDF(variable, "see_source", slice.latitudes(), slice.longitudes(), slice.data());
		return netcdfResponse(ncData, String.format("slice_%s_t%d_a%d.nc", variable, time, altitude));
	}

	// =========================================================================
	// Helpers
	// =========================================================================

	private ResponseEntity<String> csvResponse(String csvContent, String filename) {
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(TEXT_CSV);
		headers.setContentDispositionFormData("attachment", filename);
		headers.setCacheControl(CacheControl.noStore().getHeaderValue());
		return new ResponseEntity<>(csvContent, headers, HttpStatus.OK);
	}

	private ResponseEntity<byte[]> netcdfResponse(byte[] data, String filename) {
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(NETCDF);
		headers.setContentDispositionFormData("attachment", filename);
		headers.setCacheControl(CacheControl.noStore().getHeaderValue());
		return new ResponseEntity<>(data, headers, HttpStatus.OK);
	}
}
