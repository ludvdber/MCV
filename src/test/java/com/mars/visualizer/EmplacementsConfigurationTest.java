package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;

import java.nio.file.Paths;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Les emplacements de configuration ajoutes a ceux de Spring.
 *
 * <p>Spring ne lit {@code application.properties} que dans le repertoire
 * COURANT. Mesure sur un vrai serveur : le JAR dans {@code /mnt/data/app}, la
 * commande tapee depuis {@code /root}, et la configuration rangee aupres du
 * JAR n'etait jamais lue. Deposer le modele a cote du JAR sans ajouter ce
 * dossier aux emplacements aurait cree le fichier la ou personne ne le lit,
 * c'est-a-dire pire que le defaut d'origine : les deux moities ne valent que
 * l'une avec l'autre.
 */
class EmplacementsConfigurationTest {

	/** Le chemin tel que Spring le verra, une fois absolu et en barres avant.
	 *  On le derive du meme Path que le code : une attente ecrite en dur
	 *  supposerait une plateforme, et le JAR est construit ici puis deploye
	 *  sur Linux. */
	private static String attendu(String chemin) {
		return Paths.get(chemin).toAbsolutePath().toString().replace('\\', '/');
	}

	@Test
	@DisplayName("Le dossier du JAR et son sous-dossier config sont tous deux declares")
	void couvreLesDeuxFormes() {
		String base = attendu("/mnt/data/app");
		String v = MarsVisualizerApplication.formater(Paths.get("/mnt/data/app"));
		assertThat(v).contains("optional:file:" + base + "/");
		assertThat(v).contains("optional:file:" + base + "/config/");
	}

	@Test
	@DisplayName("Chaque emplacement finit par une barre")
	void barreFinaleObligatoire() {
		// Spring distingue un REPERTOIRE a explorer d'un FICHIER a charger par
		// ce seul caractere : sans elle le reglage ne ferait rien, en silence.
		for (String emplacement : MarsVisualizerApplication.formater(Paths.get("/opt/mcv")).split(";")) {
			assertThat(emplacement).endsWith("/");
		}
	}

	@Test
	@DisplayName("Chaque emplacement est optionnel")
	void jamaisFatal() {
		// Sans « optional: », un dossier absent fait echouer le demarrage.
		for (String emplacement : MarsVisualizerApplication.formater(Paths.get("/opt/mcv")).split(";")) {
			assertThat(emplacement).startsWith("optional:file:");
		}
	}

	@Test
	@DisplayName("Un chemin Windows est traduit en URL utilisable")
	void cheminWindows() {
		// Une antislash dans une URL file: n'est pas un separateur : le JAR est
		// construit ici et deploye sur Linux, les deux doivent marcher.
		assertThat(MarsVisualizerApplication.formater(Paths.get("C:\\mcv\\app")))
				.doesNotContain("\\")
				.contains("mcv/app/");
	}

	@Test
	@DisplayName("Sans JAR (tests, IDE) aucun emplacement n'est ajoute")
	void pasDeJarPasDAjout() {
		// La suite tourne depuis un classpath eclate : le repertoire courant
		// est deja un emplacement par defaut, il n'y a rien a ajouter.
		assertThat(MarsVisualizerApplication.emplacementsSupplementaires()).isEmpty();
	}
}
