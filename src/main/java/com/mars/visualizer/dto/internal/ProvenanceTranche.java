package com.mars.visualizer.dto.internal;

import java.util.List;

/**
 * D'où vient une tranche exportée : quel jeu de données, quelle variable,
 * quel pas de temps, quelle altitude.
 *
 * <p>Sans elle, l'export NetCDF était anonyme. Mesuré avant correction :
 * {@code TT}, pas de temps 0, altitude 0, extrait de {@code Ls 0-30}
 * (printemps nord) puis de {@code Ls 270-300} (été sud), produisait deux
 * fichiers portant le même nom {@code slice_TT_t0_a0.nc} et des attributs
 * globaux rigoureusement identiques. Deux saisons opposées, indiscernables une
 * fois téléchargées, le navigateur nommant silencieusement la seconde
 * « (1) ». L'export CSV n'avait pas ce défaut : son nom de fichier portait
 * déjà l'identifiant du jeu.
 *
 * <p>Une provenance incomplète ne doit jamais faire échouer un export : les
 * champs peuvent être {@code null} et la liste vide, auquel cas le fichier est
 * simplement écrit sans ces attributs.
 *
 * @param datasetId     identifiant du jeu (il porte l'année martienne et la
 *                      plage de Ls)
 * @param variable      code de la variable extraite
 * @param timeIndex     index du pas de temps demandé
 * @param altitudeIndex index du niveau, ou {@code null} pour une variable de
 *                      surface qui n'en a pas
 * @param coordonnees   coordonnées scalaires à écrire (temps, altitude)
 */
public record ProvenanceTranche(String datasetId, String variable, int timeIndex,
		Integer altitudeIndex, List<CoordonneeScalaire> coordonnees) {

	public ProvenanceTranche {
		coordonnees = coordonnees == null ? List.of() : List.copyOf(coordonnees);
	}

	/** Provenance vide : l'export reste possible, il perd seulement sa traçabilité. */
	public static ProvenanceTranche inconnue() {
		return new ProvenanceTranche(null, null, -1, null, List.of());
	}
}
