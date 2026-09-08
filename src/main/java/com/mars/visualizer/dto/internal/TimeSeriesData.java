package com.mars.visualizer.dto.internal;

import java.util.List;

/**
 * Série temporelle en un point, accompagnée du nœud de grille réellement lu.
 *
 * <p>{@code extractTimeSeries} ne rendait que les valeurs, si bien que le
 * contrôleur n'avait rien d'autre à annoncer que la coordonnée <b>demandée</b>.
 * Sur une grille de 4 degrés, une demande à 38 S est servie par le nœud à 40 S,
 * et le graphique s'intitulait « Lat -38 » en traçant les valeurs de -40 : un
 * écart muet de 2 degrés, reporté tel quel dans le permalien et l'export.
 *
 * <p>Les deux endpoints ponctuels voisins, profil vertical et profil temporel,
 * rendaient déjà leur {@code actualLat}, et la rose des vents rend les deux
 * coordonnées. C'est ce dernier modèle qui est suivi : rien n'est perdu, le
 * client choisit ce qu'il affiche.
 *
 * @param values    une valeur par pas de temps
 * @param actualLat latitude du nœud de grille effectivement lu
 * @param actualLon longitude du nœud de grille effectivement lu
 */
public record TimeSeriesData(List<Float> values, double actualLat, double actualLon) {}
