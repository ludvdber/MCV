package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.stream.Stream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.mars.visualizer.config.CacheControlFilter;

/**
 * Les fichiers dont le nom porte une empreinte de contenu doivent etre gardes
 * longtemps, et ceux dont le nom est stable ne doivent surtout pas l'etre.
 *
 * <p>Le second point est le vrai piege : une regle unique qui garderait aussi
 * {@code index.html} ou le service worker rendrait les mises en ligne
 * invisibles aux navigateurs ayant deja visite le site. Le test verifie donc
 * les deux sens, et pas seulement la presence de l'en-tete.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CacheControlFilterTest {

	@LocalServerPort
	private int port;

	@DynamicPropertySource
	static void dataPaths(DynamicPropertyRegistry registry) throws IOException {
		Path root = Files.createTempDirectory("mcv-cache");
		root.toFile().deleteOnExit();
		Path mean = Files.createDirectories(root.resolve("mean"));
		Path individual = Files.createDirectories(root.resolve("individual"));
		registry.add("netcdf.mean.path", () -> mean.toString());
		registry.add("netcdf.individual.path", () -> individual.toString());
	}

	@Test
	@DisplayName("Les noms a empreinte sont immuables, les noms stables ne le sont pas")
	void reglesDeCache() {
		assertThat(CacheControlFilter.cacheControlFor("/assets/plotly-Da7LNxAw.js")).contains("immutable");
		assertThat(CacheControlFilter.cacheControlFor("/assets/index-YnE6Kxp_.css")).contains("immutable");
		assertThat(CacheControlFilter.cacheControlFor("/fonts/orbitron-yMJRMIlz.woff2")).contains("immutable");
		assertThat(CacheControlFilter.cacheControlFor("/workbox-dcde9eb3.js")).contains("immutable");

		// Ceux-la font decouvrir les nouveaux paquets : jamais d'immutable.
		for (String stable : new String[] { "/", "/index.html", "/sw.js", "/registerSW.js",
				"/theme-init.js", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml",
				"/slice", "/explore" }) {
			assertThat(CacheControlFilter.cacheControlFor(stable))
					.as("%s doit rester revalide", stable)
					.isEqualTo("no-cache");
		}

		assertThat(CacheControlFilter.cacheControlFor("/logo.png")).isEqualTo("public, max-age=604800");
		assertThat(CacheControlFilter.cacheControlFor("/mars.glb")).isEqualTo("public, max-age=604800");

		// Le filtre se tait sur /api : le cache des donnees scientifiques est
		// decide par AbstractDataController, qui connait leur duree de validite.
		assertThat(CacheControlFilter.cacheControlFor("/api/data/slice")).isNull();
		assertThat(CacheControlFilter.cacheControlFor("/api/catalog")).isNull();
	}

	private HttpResponse<Void> head(String path) throws Exception {
		return HttpClient.newHttpClient().send(
				HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).build(),
				HttpResponse.BodyHandlers.discarding());
	}

	@Test
	@DisplayName("L'en-tete est reellement servi, et pas ecrase par Spring")
	void enTeteReellementServi() throws Exception {
		Path assets = new ClassPathResource("static/assets").getFile().toPath();
		String script;
		try (Stream<Path> files = Files.list(assets)) {
			script = "/assets/" + files.filter(p -> p.getFileName().toString().endsWith(".js"))
					.max(Comparator.comparingLong(p -> p.toFile().length()))
					.orElseThrow(() -> new IllegalStateException("Aucun .js dans static/assets."))
					.getFileName();
		}

		assertThat(head(script).headers().firstValue("Cache-Control"))
				.as("un paquet a empreinte doit etre gardable un an")
				.contains("public, max-age=31536000, immutable");

		assertThat(head("/index.html").headers().firstValue("Cache-Control"))
				.as("index.html doit etre revalide a chaque visite")
				.contains("no-cache");

		// AbstractDataController pose deja META_CACHE (1 h) sur le catalogue et
		// DATA_CACHE (30 j) sur les donnees : le filtre ne doit pas les ecraser.
		assertThat(head("/api/catalog").headers().firstValue("Cache-Control"))
				.as("le filtre laisse au controleur le cache des reponses d'API")
				.contains("max-age=3600, public");
	}
}
