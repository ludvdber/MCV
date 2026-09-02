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

/**
 * Un appelant qui n'arrive PAS par un proxy de confiance ne doit pas pouvoir
 * choisir la clé de limitation en s'inventant un {@code X-Forwarded-For}.
 *
 * <p>Le défaut corrigé : {@code server.forward-headers-strategy=framework}
 * faisait réécrire {@code getRemoteAddr()} depuis l'en-tête quel qu'en soit
 * l'émetteur, et en retenait la première valeur, celle du client. Une IP
 * saturée répondait 429, la même requête avec un en-tête inventé repassait à
 * 200. La stratégie {@code native} confie l'arbitrage au {@code RemoteIpValve}
 * de Tomcat, qui n'ouvre l'en-tête qu'aux pairs listés dans
 * {@code internal-proxies}.
 *
 * <p>Ici cette liste est volontairement réduite à une plage de documentation
 * (RFC 5737) : la boucle locale d'où appelle le test n'en fait donc pas partie,
 * ce qui reproduit le cas d'une application jointe en direct.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = {
				"ratelimit.requests-per-minute=3",
				"server.forward-headers-strategy=native",
				"server.tomcat.remoteip.internal-proxies=192.0.2.0/24"
		})
class RateLimitSpoofingTest {

	private static final int LIMIT = 3;
	private static final String PROBE = "/api/catalog";

	@LocalServerPort
	private int port;

	@DynamicPropertySource
	static void dataPaths(DynamicPropertyRegistry registry) throws IOException {
		Path root = Files.createTempDirectory("mcv-ratelimit-spoof");
		root.toFile().deleteOnExit();
		Path mean = Files.createDirectories(root.resolve("mean"));
		Path individual = Files.createDirectories(root.resolve("individual"));
		registry.add("netcdf.mean.path", () -> mean.toString());
		registry.add("netcdf.individual.path", () -> individual.toString());
	}

	/** Requete brute : le client JDK n'ajoute aucun en-tete de son cru. */
	private int statusWithForwardedFor(String value) {
		try {
			HttpRequest.Builder request = HttpRequest.newBuilder(
					URI.create("http://localhost:" + port + PROBE));
			if (value != null) {
				request.header("X-Forwarded-For", value);
			}
			return HttpClient.newHttpClient()
					.send(request.build(), HttpResponse.BodyHandlers.discarding())
					.statusCode();
		} catch (Exception e) {
			throw new IllegalStateException("Appel de " + PROBE + " impossible", e);
		}
	}

	@Test
	@DisplayName("Un X-Forwarded-For invente ne cree pas un nouveau quota")
	void enTeteInventeNeCreePasDeNouveauQuota() {
		// Chaque requete annonce une IP differente : sous l'ancien comportement
		// chacune ouvrait son propre compteur et aucune n'atteignait la limite.
		for (int i = 0; i < LIMIT; i++) {
			assertThat(statusWithForwardedFor("203.0.113." + i))
					.as("requete %d, sous la limite", i + 1)
					.isNotEqualTo(429);
		}

		assertThat(statusWithForwardedFor("203.0.113.200"))
				.as("une IP encore jamais annoncee ne doit pas rouvrir de quota")
				.isEqualTo(429);

		assertThat(statusWithForwardedFor(null))
				.as("le compteur sature est bien celui de l'adresse reelle")
				.isEqualTo(429);
	}
}
