package com.mars.visualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.dto.internal.AnimationData;
import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.dto.response.TidesResponse;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;
import com.mars.visualizer.util.StatsCalculator;
import com.mars.visualizer.util.TidesCalculator;

/**
 * Controller REST pour les marées thermiques atmosphériques.
 *
 * Décompose le cycle diurne (48 pas d'heure locale) en harmoniques 1 et 2 :
 * cartes d'amplitude et de phase des marées diurne et semi-diurne, un produit
 * de référence de la climatologie martienne (cf. Mars Climate Database).
 *
 * @author Ludo
 * @version 1.0
 */
@RestController
@RequestMapping("/api")
public class TidesController extends AbstractDataController {

	private final NetCDFReaderService netcdfService;

	public TidesController(NetCDFReaderService netcdfService,
			ValidationService validationService,
			DatasetResolver datasetResolver) {
		super(validationService, datasetResolver);
		this.netcdfService = netcdfService;
	}

	@GetMapping("/data/tides")
	public ResponseEntity<TidesResponse> getTides(
			@RequestParam String dataset,
			@RequestParam(defaultValue = "TT") String variable,
			@RequestParam(defaultValue = "0") int altitude) {

		if (datasetResolver.isIndividualDataset(dataset)) {
			throw new ValidationException("error.individual.tides");
		}

		String filename = datasetResolver.resolveFilename(dataset);
		validationService.validateAltitude(altitude);

		AnimationData anim = netcdfService.extractAnimationFrames(filename, variable, altitude);
		if (anim.frames().isEmpty()) {
			throw new ValidationException("error.individual.tides");
		}

		TidesCalculator.TidesResult tides = TidesCalculator.compute(anim.frames());

		StatsResult statsDiurnal     = StatsCalculator.calculateStatsWeighted(tides.amplitudeDiurnal(), anim.latitudes());
		StatsResult statsSemidiurnal = StatsCalculator.calculateStatsWeighted(tides.amplitudeSemidiurnal(), anim.latitudes());
		Double altitudeValue         = netcdfService.extractAltitudeValue(filename, variable, altitude);

		var response = new TidesResponse(
				dataset, variable, altitude, altitudeValue,
				anim.latitudes(), anim.longitudes(),
				tides.mean(),
				tides.amplitudeDiurnal(), tides.phaseDiurnal(),
				tides.amplitudeSemidiurnal(), tides.phaseSemidiurnal(),
				statsDiurnal, statsSemidiurnal);

		return cachedOk(response);
	}
}
