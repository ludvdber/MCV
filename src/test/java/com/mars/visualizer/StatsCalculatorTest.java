package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.mars.visualizer.dto.response.StatsResult;
import com.mars.visualizer.util.StatsCalculator;

class StatsCalculatorTest {

    @Test
    @DisplayName("Min correct sur un tableau standard")
    void minCorrectSurTableauStandard() {
        float[][] data = {{1f, 2f}, {3f, 4f}, {5f, 0f}};
        StatsResult stats = StatsCalculator.calculateStats(data);

        assertThat(stats.min())
                .as("Le min doit être 0.0")
                .isEqualTo(0.0);
    }

    @Test
    @DisplayName("Max correct sur un tableau standard")
    void maxCorrectSurTableauStandard() {
        float[][] data = {{1f, 2f}, {3f, 4f}, {5f, 0f}};
        StatsResult stats = StatsCalculator.calculateStats(data);

        assertThat(stats.max())
                .as("Le max doit être 5.0")
                .isEqualTo(5.0);
    }

    @Test
    @DisplayName("Mean correct sur un tableau standard")
    void meanCorrectSurTableauStandard() {
        float[][] data = {{1f, 2f}, {3f, 4f}, {5f, 0f}};
        StatsResult stats = StatsCalculator.calculateStats(data);

        assertThat(stats.mean())
                .as("La moyenne doit être 2.5")
                .isCloseTo(2.5, within(0.001));
    }

    @Test
    @DisplayName("Tableau avec NaN — NaN ignorés dans le calcul")
    void nanIgnoresDansLeCalcul() {
        float[][] withNaN = {{Float.NaN, 2f}, {3f, Float.NaN}};
        StatsResult stats = StatsCalculator.calculateStats(withNaN);

        assertThat(stats.min())
                .as("Le min sans NaN doit être 2.0")
                .isEqualTo(2.0);
        assertThat(stats.max())
                .as("Le max sans NaN doit être 3.0")
                .isEqualTo(3.0);
    }

    @Test
    @DisplayName("Tableau vide — IllegalArgumentException levée")
    void tableauVideLeveException() {
        float[][] empty = {};

        assertThatThrownBy(() -> StatsCalculator.calculateStats(empty))
                .as("Un tableau vide doit lever IllegalArgumentException")
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Tableau d'un seul élément — min == max == mean")
    void tableauUnSeulElement() {
        float[][] single = {{42f}};
        StatsResult stats = StatsCalculator.calculateStats(single);

        assertThat(stats.min())
                .as("Le min doit être 42.0")
                .isEqualTo(42.0);
        assertThat(stats.max())
                .as("Le max doit être 42.0")
                .isEqualTo(42.0);
        assertThat(stats.mean())
                .as("La moyenne doit être 42.0")
                .isEqualTo(42.0);
    }
}
