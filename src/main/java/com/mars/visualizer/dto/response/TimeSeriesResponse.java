package com.mars.visualizer.dto.response;

import java.util.List;

/**
 * Réponse contenant une série temporelle d'une variable atmosphérique.
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 *
 * <p>{@code latitude} et {@code longitude} sont ce que le client a DEMANDÉ ;
 * {@code actualLat} et {@code actualLon} le nœud de grille effectivement lu.
 * Les deux, parce que la grille fait 4 degrés : la réponse ne portait que la
 * demande, et le graphique s'intitulait donc « Lat -38 » en traçant les valeurs
 * du nœud à -40, écart muet repris tel quel dans le permalien. Même contrat
 * que {@code WindRoseResponse}, qui rendait déjà les deux.
 */
public record TimeSeriesResponse(
    String dataset,
    String variable,
    Double latitude,
    Double longitude,
    Double actualLat,
    Double actualLon,
    Integer altitudeIndex,
    Double altitudeValue,
    List<Float> values,
    StatsResult stats
) {}
