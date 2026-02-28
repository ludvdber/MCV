package com.mars.visualizer.dto.response;

/**
 * Statistiques descriptives calculées sur un jeu de données.
 * Record Java 21 — immuable, sérialisé nativement par Jackson 3.
 */
public record StatsResult(Double min, Double max, Double mean, Double stddev) {}
