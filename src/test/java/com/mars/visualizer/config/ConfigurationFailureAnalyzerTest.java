package com.mars.visualizer.config;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Properties;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.BeanCreationException;
import org.springframework.boot.diagnostics.FailureAnalysis;
import org.springframework.boot.diagnostics.FailureAnalyzer;

/**
 * Ce que l'exploitant lit quand l'application refuse de demarrer.
 *
 * <p>La phrase qui dit quoi corriger existait deja ; le probleme etait qu'on ne
 * la voyait pas. Mesure sur le JAR livre, pour une adresse de site sans
 * protocole : soixante lignes de trace de pile, trois « Caused by », et la
 * seule phrase utile tout en bas — sans meme un message de niveau ERROR pour
 * l'annoncer. Pour un chemin de donnees introuvable le message ERROR existait,
 * mais il etait suivi de quarante lignes de {@code BeanCreationException} qui
 * donnaient a une ligne de configuration oubliee l'apparence d'un plantage de
 * l'application.
 *
 * <p>Un {@link FailureAnalyzer} est le mecanisme que Spring Boot reserve
 * exactement a ce cas : il remplace la trace par « APPLICATION FAILED TO START »
 * suivi d'une description et d'une action, et relegue la pile au niveau DEBUG.
 * On ne gagne aucune information, on en perd en bruit.
 */
class ConfigurationFailureAnalyzerTest {

	private static final String CLE = "org.springframework.boot.diagnostics.FailureAnalyzer";

	private final ConfigurationFailureAnalyzer analyseur = new ConfigurationFailureAnalyzer();

	@Nested
	@DisplayName("Lecture de l'echec")
	class Lecture {

		/**
		 * L'exception ne remonte jamais nue : Spring l'enveloppe dans une
		 * {@code BeanCreationException}, elle-meme enveloppee. L'analyseur doit
		 * donc la trouver DANS la chaine des causes, pas au sommet — sinon il ne
		 * se declencherait qu'en test.
		 */
		@Test
		@DisplayName("L'exception est trouvee au fond de la chaine des causes")
		void auFondDeLaChaine() {
			ConfigurationInvalideException refus = new ConfigurationInvalideException(
					"Le répertoire MEAN n'existe pas : D:\\absent.",
					"Renseignez « netcdf.mean.path ».");
			Throwable enveloppee = new IllegalStateException("contexte",
					new BeanCreationException("dataPathConfig", "init", refus));

			FailureAnalysis a = analyseur.analyze(enveloppee);

			assertNotNull(a, "sans cela, la console retombe sur la trace de pile");
			assertEquals(refus.probleme(), a.getDescription());
			assertEquals(refus.action(), a.getAction());
		}

		/**
		 * Un analyseur trop large serait pire que pas d'analyseur : il masquerait
		 * la trace de pile de pannes que personne n'a prevues, celles ou la pile
		 * est la seule chose utile.
		 */
		@Test
		@DisplayName("Une panne ordinaire garde sa trace de pile")
		void panneOrdinaire() {
			assertNull(analyseur.analyze(new IllegalStateException("bean casse")));
			assertNull(analyseur.analyze(new BeanCreationException("x", "y",
					new NullPointerException())));
		}

		/**
		 * Les deux moities ne disent pas la meme chose et ne vont pas au meme
		 * endroit : la description nomme la valeur fautive, l'action nomme la
		 * cle a remplir. Les melanger redonnerait le pave qu'on vient de
		 * supprimer.
		 */
		@Test
		@DisplayName("Description et action restent separees")
		void deuxMoities() {
			FailureAnalysis a = analyseur.analyze(new ConfigurationInvalideException(
					"valeur fautive", "cle a remplir"));

			assertEquals("valeur fautive", a.getDescription());
			assertEquals("cle a remplir", a.getAction());
			assertFalse(a.getDescription().contains("cle a remplir"));
		}
	}

	@Nested
	@DisplayName("Enregistrement")
	class Enregistrement {

		/**
		 * LE test qui compte. Rien dans le code ne reference cette classe :
		 * Spring Boot la decouvre par {@code META-INF/spring.factories}. Perdre
		 * cette ligne ne casse aucune compilation et ne fait echouer aucun autre
		 * test — la console redeviendrait simplement illisible, et on ne s'en
		 * apercevrait qu'au prochain deploiement rate.
		 */
		@Test
		@DisplayName("spring.factories declare l'analyseur")
		void declare() throws IOException {
			List<String> declares = analyseursDeclares();

			assertTrue(declares.contains(ConfigurationFailureAnalyzer.class.getName()),
					"analyseurs trouves dans les spring.factories du classpath : " + declares);
		}

		/**
		 * Un nom de classe dans un fichier texte n'est verifie par aucun
		 * compilateur : renommer ou deplacer la classe laisse une entree morte,
		 * que Spring Boot ignore en silence.
		 */
		@Test
		@DisplayName("Le nom declare designe bien une classe chargeable")
		void chargeable() throws Exception {
			String nom = ConfigurationFailureAnalyzer.class.getName();
			assertTrue(analyseursDeclares().contains(nom));

			Class<?> c = Class.forName(nom);
			assertTrue(FailureAnalyzer.class.isAssignableFrom(c),
					"Spring Boot n'instancie que des FailureAnalyzer");
			assertDoesNotThrow(() -> c.getDeclaredConstructor().newInstance(),
					"Spring Boot appelle le constructeur sans argument");
		}

		/** Toutes les classes declarees sous la cle FailureAnalyzer du classpath. */
		private List<String> analyseursDeclares() throws IOException {
			List<String> noms = new ArrayList<>();
			for (URL url : Collections.list(
					getClass().getClassLoader().getResources("META-INF/spring.factories"))) {
				Properties p = new Properties();
				try (InputStream in = url.openStream()) {
					p.load(in);
				}
				String valeur = p.getProperty(CLE);
				if (valeur != null) {
					for (String nom : valeur.split(",")) {
						noms.add(nom.trim());
					}
				}
			}
			return noms;
		}
	}
}
