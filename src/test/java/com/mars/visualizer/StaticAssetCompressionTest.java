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

/**
 * Le JavaScript de l'interface doit partir compresse.
 *
 * <p>Le defaut corrige : Tomcat annonce les fichiers .js en
 * {@code text/javascript}, alors que {@code server.compression.mime-types} ne
 * citait que {@code application/javascript}. Le HTML et le CSS partaient donc
 * bien en gzip, et tout le JavaScript en clair : le seul paquet Plotly pesait
 * 1148 Ko au lieu de 389 Ko.
 *
 * <p>Le test interroge un vrai fichier produit par le build du frontend
 * ({@code copyFrontend} est une dependance de {@code classes}), et compare la
 * reponse compressee a la reponse brute : il tomberait aussi bien si le type
 * MIME changeait a nouveau que si la liste redevenait incomplete.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class StaticAssetCompressionTest {

	@LocalServerPort
	private int port;

	@DynamicPropertySource
	static void dataPaths(DynamicPropertyRegistry registry) throws IOException {
		Path root = Files.createTempDirectory("mcv-compression");
		root.toFile().deleteOnExit();
		Path mean = Files.createDirectories(root.resolve("mean"));
		Path individual = Files.createDirectories(root.resolve("individual"));
		registry.add("netcdf.mean.path", () -> mean.toString());
		registry.add("netcdf.individual.path", () -> individual.toString());
	}

	/** Le plus gros paquet JavaScript du build : celui dont la compression compte. */
	private static String largestScriptPath() throws IOException {
		Path assets = new ClassPathResource("static/assets").getFile().toPath();
		try (Stream<Path> files = Files.list(assets)) {
			Path biggest = files.filter(p -> p.getFileName().toString().endsWith(".js"))
					.max(Comparator.comparingLong(p -> p.toFile().length()))
					.orElseThrow(() -> new IllegalStateException(
							"Aucun .js dans static/assets : le build du frontend n'a pas ete copie."));
			return "/assets/" + biggest.getFileName();
		}
	}

	private HttpResponse<byte[]> fetch(String path, String acceptEncoding) throws Exception {
		HttpRequest.Builder request = HttpRequest.newBuilder(
				URI.create("http://localhost:" + port + path));
		if (acceptEncoding != null) {
			request.header("Accept-Encoding", acceptEncoding);
		}
		return HttpClient.newHttpClient().send(request.build(), HttpResponse.BodyHandlers.ofByteArray());
	}

	@Test
	@DisplayName("Le plus gros paquet JavaScript est servi en gzip")
	void leJavaScriptEstServiEnGzip() throws Exception {
		String path = largestScriptPath();

		HttpResponse<byte[]> plain = fetch(path, null);
		assertThat(plain.statusCode()).isEqualTo(200);
		assertThat(plain.body().length)
				.as("le fichier doit depasser server.compression.min-response-size")
				.isGreaterThan(1024);

		HttpResponse<byte[]> compressed = fetch(path, "gzip");
		assertThat(compressed.statusCode()).isEqualTo(200);
		assertThat(compressed.headers().firstValue("Content-Encoding"))
				.as("le type MIME des .js doit figurer dans server.compression.mime-types")
				.contains("gzip");
		assertThat(compressed.body().length)
				.as("la reponse compressee doit etre nettement plus courte")
				.isLessThan(plain.body().length / 2);
	}

	@Test
	@DisplayName("La feuille de style est servie en gzip elle aussi")
	void leCssEstServiEnGzip() throws Exception {
		Path assets = new ClassPathResource("static/assets").getFile().toPath();
		String path;
		try (Stream<Path> files = Files.list(assets)) {
			path = "/assets/" + files.filter(p -> p.getFileName().toString().endsWith(".css"))
					.max(Comparator.comparingLong(p -> p.toFile().length()))
					.orElseThrow(() -> new IllegalStateException("Aucun .css dans static/assets."))
					.getFileName();
		}

		HttpResponse<byte[]> compressed = fetch(path, "gzip");
		assertThat(compressed.statusCode()).isEqualTo(200);
		assertThat(compressed.headers().firstValue("Content-Encoding")).contains("gzip");
	}
}
