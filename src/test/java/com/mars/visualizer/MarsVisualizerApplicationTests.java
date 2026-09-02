package com.mars.visualizer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Le contexte complet doit se construire.
 *
 * <p>Les chemins de donnees pointent sur des repertoires temporaires vides : le
 * test verifie le cablage de l'application, pas la presence de fichiers NetCDF
 * sur la machine qui l'execute. Sans cela il dependrait de la configuration
 * locale du developpeur, et echouerait sur une machine d'integration.
 */
@SpringBootTest
class MarsVisualizerApplicationTests {

	@DynamicPropertySource
	static void dataPaths(DynamicPropertyRegistry registry) throws IOException {
		Path root = Files.createTempDirectory("mcv-context");
		root.toFile().deleteOnExit();
		Path mean = Files.createDirectories(root.resolve("mean"));
		Path individual = Files.createDirectories(root.resolve("individual"));
		registry.add("netcdf.mean.path", () -> mean.toString());
		registry.add("netcdf.individual.path", () -> individual.toString());
	}

	@Test
	void contextLoads() {
	}

}
