package com.mars.visualizer.dto.internal;

/**
 * Une coordonnée réduite à un point, destinée à être écrite comme variable
 * scalaire dans un export NetCDF (CF-1.8, § 5.7).
 *
 * <p>Une tranche 2D est extraite à UN instant et à UNE altitude. Ces deux
 * informations disparaissaient de l'export : deux fichiers issus de saisons
 * opposées sortaient sous le même nom, avec des métadonnées identiques au
 * bit près. Une coordonnée scalaire les rend visibles dans n'importe quel
 * lecteur CF (xarray, Panoply) au lieu de les laisser au seul nom de fichier,
 * qui ne survit pas à un renommage.
 *
 * <p>Les métadonnées sont RECOPIÉES du fichier GEM-Mars source, jamais
 * déduites : les deux familles de jeux n'ont pas la même convention de temps
 * (« hours » d'heure solaire locale pour un MEAN, « hours since 1970-01-01 »
 * pour un INDIVIDUAL). Supposer l'une des deux écrirait une valeur absurde
 * dans l'autre cas.
 *
 * @param nom      nom de la variable scalaire écrite (« time », « altitude »)
 * @param valeur   valeur de la coordonnée au point extrait
 * @param meta     unité et libellés CF lus dans le fichier source
 * @param axe      axe CF (« T », « Z »), ou {@code null} si indéterminé
 * @param positive sens de l'axe vertical (« up ») tel que déclaré par la
 *                 source, ou {@code null} si elle ne le déclare pas
 */
public record CoordonneeScalaire(String nom, double valeur, VariableMetadata meta,
		String axe, String positive) {
}
