package com.mars.visualizer.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Statistiques descriptives calculées sur un jeu de données.
 * Utilisé comme champ embarqué dans les autres DTOs de réponse.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class StatsResult {

    private Double min;
    private Double max;
    private Double mean;

    /** Écart-type du jeu de données. */
    private Double stddev;
}
