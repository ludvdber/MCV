package com.mars.visualizer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import com.mars.visualizer.config.ConfigTemplateWriter;

@SpringBootApplication
public class MarsVisualizerApplication {

	public static void main(String[] args) {
		// AVANT le demarrage, pour que Spring relise dans la foulee le fichier
		// qu'on vient d'ecrire : une installation neuve echoue alors sur le
		// message qui nomme un fichier existant, pas un fichier a inventer.
		ConfigTemplateWriter.ecrireSiAbsent();
		SpringApplication.run(MarsVisualizerApplication.class, args);
	}

}
