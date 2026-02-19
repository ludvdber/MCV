package com.mars.visualizer.dto.response;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Metadonnees d'une annee martienne disponible dans les fichiers individuels.
 * Contient les bornes de longitude solaire (Ls) couvertes et les repertoires sources.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class IndividualYearInfo {

	/** Annee martienne (ex: 34). */
	private int marsYear;

	/** Ls minimum disponible pour cette annee. */
	private double lsMin;

	/** Ls maximum disponible pour cette annee. */
	private double lsMax;

	/** Noms des sous-repertoires couvrant cette annee (ex: ["000960", "001920"]). */
	private List<String> directories;
}
