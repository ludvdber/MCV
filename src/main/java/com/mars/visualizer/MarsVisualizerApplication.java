package com.mars.visualizer;

import java.nio.file.Path;
import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import com.mars.visualizer.config.ConfigTemplateWriter;

@SpringBootApplication
public class MarsVisualizerApplication {

	/**
	 * Emplacements de configuration ajoutes a ceux de Spring.
	 *
	 * <p>Spring cherche {@code application.properties} dans le repertoire
	 * COURANT ({@code ./} puis {@code ./config/}). C'est un defaut raisonnable
	 * pour un service lance par systemd avec un {@code WorkingDirectory}, et un
	 * piege pour tout le monde d'autre : mesure faite sur un vrai serveur,
	 * {@code java -jar /mnt/data/app/mars-visualizer.jar} tape depuis
	 * {@code /root} ne lit que {@code /root/config/}, alors que l'exploitant
	 * range evidemment sa configuration aupres du JAR.
	 *
	 * <p>On ajoute donc le dossier du JAR aux emplacements lus. « Additional »
	 * et non « location » : les emplacements par defaut restent actifs, donc le
	 * repertoire courant continue de fonctionner et rien de ce qui marchait ne
	 * casse. Les deux formes sont declarees, a plat et dans {@code config/},
	 * comme Spring le fait pour le repertoire courant.
	 */
	static final String CLE_EMPLACEMENTS = "spring.config.additional-location";

	public static void main(String[] args) {
		// AVANT le demarrage, pour que Spring relise dans la foulee le fichier
		// qu'on vient d'ecrire : une installation neuve echoue alors sur le
		// message qui nomme un fichier existant, pas un fichier a inventer.
		ConfigTemplateWriter.ecrireSiAbsent(args);

		SpringApplication application = new SpringApplication(MarsVisualizerApplication.class);
		emplacementsSupplementaires().ifPresent(valeur ->
				// En proprietes PAR DEFAUT : c'est la precedence la plus basse,
				// donc un --spring.config.additional-location explicite de
				// l'exploitant l'emporte toujours sur ce confort.
				application.setDefaultProperties(Map.of(CLE_EMPLACEMENTS, valeur)));
		application.run(args);
	}

	/**
	 * Les emplacements a ajouter, ou vide s'il n'y a pas de JAR (developpement,
	 * tests, classpath eclate) : le repertoire courant suffit alors, et c'est
	 * deja un emplacement par defaut.
	 */
	static java.util.Optional<String> emplacementsSupplementaires() {
		return ConfigTemplateWriter.dossierDuJar().map(MarsVisualizerApplication::formater);
	}

	/**
	 * {@code optional:} pour qu'un dossier absent ne soit pas une panne, et une
	 * barre finale parce que Spring distingue un REPERTOIRE a explorer d'un
	 * FICHIER a charger par ce seul caractere.
	 */
	static String formater(Path dossierDuJar) {
		String base = dossierDuJar.toAbsolutePath().toString().replace('\\', '/');
		if (!base.endsWith("/")) {
			base = base + "/";
		}
		return "optional:file:" + base + ";optional:file:" + base + "config/";
	}

}
