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
 * Derriere un proxy de confiance, la limitation doit au contraire viser le vrai
 * client et non le proxy : sans quoi tous les visiteurs partageraient un seul
 * quota et se bloqueraient les uns les autres.
 *
 * <p>Le second cas verifie la configuration Nginx la plus repandue,
 * {@code proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for}, qui
 * CONCATENE a la valeur envoyee par le client au lieu de la remplacer. L'en-tete
 * recu vaut alors « valeur inventee, vraie IP ». Le {@code RemoteIpValve} le
 * parcourt de droite a gauche et retient la valeur ajoutee par le proxy, donc
 * la vraie ; c'est precisement ce que la strategie {@code framework}, qui
 * retenait la premiere, ne faisait pas.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = {
				"ratelimit.requests-per-minute=3",
				"server.forward-headers-strategy=native",
				"server.tomcat.remoteip.internal-proxies=127.0.0.1/32,::1/128"
		})
class RateLimitTrustedProxyTest {

	private static final int LIMIT = 3;
	private static final String PROBE = "/api/catalog";

	@LocalServerPort
	private int port;

	@DynamicPropertySource
	static void dataPaths(DynamicPropertyRegistry registry) throws IOException {
		Path root = Files.createTempDirectory("mcv-ratelimit-proxy");
		root.toFile().deleteOnExit();
		Path mean = Files.createDirectories(root.resolve("mean"));
		Path individual = Files.createDirectories(root.resolve("individual"));
		registry.add("netcdf.mean.path", () -> mean.toString());
		registry.add("netcdf.individual.path", () -> individual.toString());
	}

	/** Requete brute : le client JDK n'ajoute aucun en-tete de son cru. */
	private int statusWithForwardedFor(String value) {
		try {
			return HttpClient.newHttpClient().send(
					HttpRequest.newBuilder(URI.create("http://localhost:" + port + PROBE))
							.header("X-Forwarded-For", value).build(),
					HttpResponse.BodyHandlers.discarding()).statusCode();
		} catch (Exception e) {
			throw new IllegalStateException("Appel de " + PROBE + " impossible", e);
		}
	}

	@Test
	@DisplayName("Deux clients distincts derriere le proxy ont deux quotas distincts")
	void deuxClientsDistinctsOntDeuxQuotas() {
		for (int i = 0; i < LIMIT; i++) {
			assertThat(statusWithForwardedFor("198.51.100.1")).isNotEqualTo(429);
		}
		assertThat(statusWithForwardedFor("198.51.100.1"))
				.as("le client qui depasse est bien bloque")
				.isEqualTo(429);

		assertThat(statusWithForwardedFor("198.51.100.2"))
				.as("son voisin ne doit pas payer pour lui")
				.isNotEqualTo(429);
	}

	@Test
	@DisplayName("Une valeur ajoutee devant la vraie IP (Nginx) ne rouvre pas de quota")
	void valeurAjouteeDevantLaVraieIpNeRouvrePasDeQuota() {
		for (int i = 0; i < LIMIT; i++) {
			assertThat(statusWithForwardedFor("203.0.113.7")).isNotEqualTo(429);
		}

		assertThat(statusWithForwardedFor("1.2.3.4, 203.0.113.7"))
				.as("la vraie IP est celle de droite, le quota est deja epuise")
				.isEqualTo(429);

		assertThat(statusWithForwardedFor("1.2.3.4, 198.51.100.50"))
				.as("temoin : un autre client passe malgre la meme valeur inventee")
				.isNotEqualTo(429);
	}
}
