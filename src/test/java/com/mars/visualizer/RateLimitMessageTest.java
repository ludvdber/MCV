package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Le 429 du limiteur de debit doit parler la langue du visiteur.
 *
 * <p>Il etait le SEUL message du backend ecrit en dur, et en anglais : toutes
 * les autres erreurs passent par {@code MessageSource}. Mesure avant
 * correction, avec {@code Accept-Language: fr} :
 * {@code {"error":"Too Many Requests","message":"Export rate limit exceeded.
 * Max 20 exports per minute."}}. Le frontend prefere le message du backend au
 * sien, donc un francophone qui saturait son quota lisait de l'anglais.
 *
 * <p>Un filtre s'executant avant la {@code DispatcherServlet},
 * {@code LocaleContextHolder} n'est pas encore rempli : c'est le
 * {@code LocaleResolver} qu'il faut interroger.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "ratelimit.requests-per-minute=2")
class RateLimitMessageTest {

	private static final int    LIMITE = 2;
	private static final String SONDE  = "/api/catalog";

	@LocalServerPort
	private int port;

	private final ObjectMapper mapper = new ObjectMapper();

	@DynamicPropertySource
	static void cheminsDonnees(DynamicPropertyRegistry registry) throws IOException {
		Path root = Files.createTempDirectory("mcv-ratelimit-msg");
		root.toFile().deleteOnExit();
		Path mean       = Files.createDirectories(root.resolve("mean"));
		Path individual = Files.createDirectories(root.resolve("individual"));
		registry.add("netcdf.mean.path", () -> mean.toString());
		registry.add("netcdf.individual.path", () -> individual.toString());
	}

	/** Sature le quota et rend la reponse 429, dans la langue demandee. */
	private HttpResponse<String> refusDansLaLangue(String acceptLanguage) {
		try {
			HttpClient client = HttpClient.newHttpClient();
			HttpResponse<String> derniere = null;
			for (int i = 0; i < LIMITE + 2; i++) {
				HttpRequest.Builder b = HttpRequest.newBuilder(
						URI.create("http://localhost:" + port + SONDE));
				if (acceptLanguage != null) {
					b.header("Accept-Language", acceptLanguage);
				}
				derniere = client.send(b.build(), HttpResponse.BodyHandlers.ofString());
			}
			assertThat(derniere.statusCode())
					.as("le quota doit etre sature apres %d appels", LIMITE + 2)
					.isEqualTo(429);
			return derniere;
		} catch (Exception e) {
			throw new IllegalStateException("Appel de " + SONDE + " impossible", e);
		}
	}

	@Test
	@DisplayName("le refus est traduit dans la langue demandée")
	void refusTraduit() {
		JsonNode fr = mapper.readTree(refusDansLaLangue("fr").body());
		assertThat(fr.get("message").asString())
				.as("un visiteur francophone ne doit pas lire de l'anglais")
				.contains("Trop de requêtes")
				.contains(String.valueOf(LIMITE))
				.contains("60");
	}

	@Test
	@DisplayName("une langue non prise en charge retombe sur l’anglais")
	void repliSurAnglais() {
		// La liste des langues acceptees vit dans LocaleConfig ; le filtre la
		// reutilise plutot que d'en tenir une seconde.
		JsonNode reponse = mapper.readTree(refusDansLaLangue("ja").body());
		assertThat(reponse.get("message").asString()).contains("Too many requests");
	}

	@Test
	@DisplayName("sans en-tête Accept-Language, la réponse est en anglais et non dans la langue du serveur")
	void sansEnTeteLangue() {
		// C'est le test qui distingue les deux facons de resoudre la locale.
		// `LocaleContextHolder` porte le `request.getLocale()` brut, et la
		// specification servlet fait rendre a celui-ci la locale par DEFAUT DU
		// SERVEUR quand l'en-tete manque : la machine de developpement etant en
		// fr_BE, un client anonyme aurait recu du francais. Le LocaleResolver
		// applique LocaleConfig, dont le repli est l'anglais.
		JsonNode reponse = mapper.readTree(refusDansLaLangue(null).body());
		assertThat(reponse.get("message").asString())
				.as("la langue de repli est celle de LocaleConfig, pas celle de la JVM")
				.contains("Too many requests")
				.doesNotContain("Trop de requêtes");
	}

	@Test
	@DisplayName("le corps reste un JSON valide et l’en-tête Retry-After l’accompagne")
	void corpsValideEtEnTete() {
		HttpResponse<String> reponse = refusDansLaLangue("de");

		// Le corps est assemble a la main dans le filtre, hors du contexte MVC :
		// on verifie qu'il se relit vraiment, message accentue compris.
		JsonNode json = mapper.readTree(reponse.body());
		assertThat(json.get("error").asString()).isEqualTo("Too Many Requests");
		assertThat(json.get("message").asString()).contains("Zu viele Anfragen");

		assertThat(reponse.headers().firstValue("Retry-After"))
				.as("sans lui, un client correct repart en boucle serree (RFC 9110)")
				.hasValue("60");
		assertThat(reponse.headers().firstValue("Content-Type"))
				.as("JSON est defini en UTF-8 ; le defaut servlet serait ISO-8859-1")
				.hasValue("application/json;charset=UTF-8");
	}

	@Test
	@DisplayName("le message accentué traverse la réponse sans être abîmé")
	void accentsIntacts() {
		// C'est ce que le charset explicite protege : tant que le message etait
		// en ASCII, l'erreur de declaration restait invisible.
		String corps = refusDansLaLangue("fr").body();
		assertThat(corps)
				.as("les accents doivent survivre a l'encodage de la reponse")
				.contains("requêtes")
				.contains("Réessayez");
	}
}
