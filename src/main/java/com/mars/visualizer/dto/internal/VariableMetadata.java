package com.mars.visualizer.dto.internal;

/**
 * Métadonnées CF d'une variable, telles qu'elles figurent dans le fichier
 * GEM-Mars source. Elles ne sont pas déduites ni complétées : ce qui est absent
 * du fichier reste {@code null}, et l'export s'abstient plutôt que d'inventer.
 *
 * @param units        unité UDUNITS (« K », « Pa », « m s-1 », « 1 »)
 * @param standardName nom normalisé CF, ou {@code null} si le fichier n'en porte pas
 * @param longName     libellé lisible, ou {@code null}
 */
public record VariableMetadata(String units, String standardName, String longName) {

	/** Repli quand le fichier source ne déclare aucune unité. */
	public static final String UNITE_INCONNUE = "unknown";

	public VariableMetadata {
		if (units == null || units.isBlank()) {
			units = UNITE_INCONNUE;
		}
	}
}
