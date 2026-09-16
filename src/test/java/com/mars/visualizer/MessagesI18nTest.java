package com.mars.visualizer;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import com.mars.visualizer.config.MessageSourceConfig;

/**
 * Les messages d'erreur backend, dans les cinq langues.
 *
 * <p>Jusqu'ici rien ne lisait ces cinq fichiers : le frontend a
 * {@code locales.test.js}, le backend n'avait rien. Le defaut que cela a laisse
 * passer est visible par n'importe quel visiteur francophone, mesure sur le
 * site en ligne avant correction :
 *
 * <pre>{@code
 * GET /api/data/timeseries?dataset=IND_MY34_LS20   Accept-Language: fr
 * {"message":"La serie temporelle n''est pas disponible pour les fichiers ..."}
 * }</pre>
 *
 * <p>L'apostrophe doublee est la convention de {@link java.text.MessageFormat},
 * qui lit une apostrophe simple comme un debut de citation. Mais
 * {@code AbstractMessageSource} ne passe par {@code MessageFormat} que si le
 * message recoit des ARGUMENTS : sans {@code alwaysUseMessageFormat}, un
 * message sans argument est renvoye tel quel, doublement compris. Six messages
 * francais etaient dans ce cas, tous des refus que l'utilisateur lit.
 *
 * <p>La regle a donc deux faces, et ce test tient les deux : un message SANS
 * argument porte des apostrophes simples, un message AVEC arguments les double.
 * Se tromper de sens dans l'autre direction est pire encore, puisque
 * {@code MessageFormat} avale alors silencieusement le texte qui suit.
 */
class MessagesI18nTest {

	private static final String[] LANGUES = { "", "_fr", "_nl", "_de", "_es" };

	/** {0}, {1}, ... : la presence d'un seul suffit a activer MessageFormat. */
	private static final Pattern ARGUMENT = Pattern.compile("\\{\\d+\\}");

	private static Properties charger(String suffixe) throws Exception {
		Properties p = new Properties();
		String nom = "/messages" + suffixe + ".properties";
		try (InputStream in = MessagesI18nTest.class.getResourceAsStream(nom)) {
			assertThat(in).as("fichier %s absent du classpath", nom).isNotNull();
			// Le lecteur UTF-8 traite AUSSI les echappements \\uXXXX, donc les
			// deux conventions presentes dans ces fichiers sont lues pareil.
			p.load(new InputStreamReader(in, StandardCharsets.UTF_8));
		}
		return p;
	}

	@Test
	@DisplayName("les cinq langues portent exactement le meme jeu de cles")
	void memeJeuDeCles() throws Exception {
		Set<String> reference = new TreeSet<>(charger("").stringPropertyNames());
		assertThat(reference).as("le fichier par defaut ne doit pas etre vide").isNotEmpty();

		for (String suffixe : LANGUES) {
			Set<String> cles = new TreeSet<>(charger(suffixe).stringPropertyNames());
			Set<String> manquantes = new TreeSet<>(reference);
			manquantes.removeAll(cles);
			Set<String> enTrop = new TreeSet<>(cles);
			enTrop.removeAll(reference);

			assertThat(manquantes).as("cles absentes de messages%s.properties", suffixe).isEmpty();
			assertThat(enTrop).as("cles en trop dans messages%s.properties", suffixe).isEmpty();
		}
	}

	/**
	 * Ce que LIT l'utilisateur, pas ce que contient le fichier : la resolution
	 * passe par le bean de production, donc un changement de configuration
	 * ({@code alwaysUseMessageFormat}) ferait bouger le resultat et le test
	 * s'en apercevrait.
	 */
	@Test
	@DisplayName("un message sans argument ne montre pas d apostrophe doublee")
	void apostrophesLisibles() throws Exception {
		try (var ctx = new AnnotationConfigApplicationContext(MessageSourceConfig.class)) {
			MessageSource source = ctx.getBean(MessageSource.class);

			Map<String, List<String>> fautifs = new LinkedHashMap<>();
			for (String suffixe : LANGUES) {
				Locale locale = suffixe.isEmpty() ? Locale.ENGLISH
						: Locale.forLanguageTag(suffixe.substring(1));
				Properties p = charger(suffixe);
				List<String> ici = new ArrayList<>();
				for (String cle : new TreeSet<>(p.stringPropertyNames())) {
					if (ARGUMENT.matcher(p.getProperty(cle)).find()) {
						continue;
					}
					String rendu = source.getMessage(cle, null, locale);
					if (rendu.contains("''")) {
						ici.add(cle + " -> " + rendu);
					}
				}
				if (!ici.isEmpty()) {
					fautifs.put("messages" + suffixe, ici);
				}
			}
			assertThat(fautifs).as("apostrophes doublees rendues telles quelles").isEmpty();

			// Le cas mesure sur le site en ligne, nomme explicitement.
			assertThat(source.getMessage("error.individual.timeseries", null, Locale.FRENCH))
					.contains("n'est")
					.doesNotContain("n''est");
		}
	}

	/**
	 * L'autre sens de la regle. Un message qui porte {@code {0}} passe par
	 * {@code MessageFormat} : une apostrophe SIMPLE y ouvre une citation et le
	 * texte qui suit disparait de la reponse sans la moindre erreur.
	 *
	 * <p>Deux formes sont legitimes et doivent survivre au controle :
	 * l'apostrophe doublee {@code ''}, et les accolades litterales
	 * {@code '{'} / {@code '}'} dont {@code error.dataset.individual.format} a
	 * besoin pour montrer le format attendu {@code IND_MY{nn}_LS{dd.dd}}.
	 */
	@Test
	@DisplayName("un message avec arguments double ses apostrophes")
	void apostrophesEchappeesQuandIlYADesArguments() throws Exception {
		List<String> fautifs = new ArrayList<>();
		for (String suffixe : LANGUES) {
			Properties p = charger(suffixe);
			for (String cle : new TreeSet<>(p.stringPropertyNames())) {
				String valeur = p.getProperty(cle);
				if (!ARGUMENT.matcher(valeur).find()) {
					continue;
				}
				String reste = valeur.replace("''", "")
						.replace("'{'", "")
						.replace("'}'", "");
				if (reste.contains("'")) {
					fautifs.add("messages" + suffixe + " : " + cle + " = " + valeur);
				}
			}
		}
		assertThat(fautifs).as("apostrophes non echappees dans un message a arguments").isEmpty();
	}
}
