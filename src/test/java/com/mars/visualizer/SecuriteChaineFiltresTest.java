package com.mars.visualizer;

import static org.assertj.core.api.Assertions.assertThat;

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
 * Les filtres de securite sont-ils reellement branches ?
 *
 * <p>{@code SecurityHeadersFilterTest} instancie le filtre et l'appelle avec
 * une {@code MockFilterChain}. Cela prouve que le filtre <b>fait</b> ce qu'il
 * annonce, et rien de plus : si demain il perdait son {@code @Component}, ou si
 * un {@code FilterRegistrationBean} le limitait a {@code /api/*}, ce test
 * continuerait a passer pendant que le site entier partirait sans en-tetes.
 *
 * <p>{@code MockMvc} ne comble pas ce trou : monte depuis le contexte web, il
 * n'execute AUCUN filtre servlet a moins qu'on ne les lui ajoute a la main —
 * ce qui reviendrait encore a tester le filtre, pas son branchement.
 *
 * <p>Il faut donc un vrai serveur. C'est le seul point d'observation ou la
 * chaine est celle de la production : Tomcat, ses valves, les filtres
 * enregistres par Spring Boot, puis la servlet. On y verifie les trois
 * proprietes qui ne se voient que la : le filtre est bien enregistre, il
 * s'applique aux routes SPA autant qu'a l'API, et il survit a une reponse
 * d'ERREUR — le moment ou le corps est le plus bavard et ou un
 * {@code X-Content-Type-Options} manquant coute le plus cher.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SecuriteChaineFiltresTest {

	@LocalServerPort
	private int port;

	@DynamicPropertySource
	static void cheminsDonnees(DynamicPropertyRegistry registry) throws IOException {
		Path racine = Files.createTempDirectory("mcv-chaine-filtres");
		racine.toFile().deleteOnExit();
		Path mean = Files.createDirectories(racine.resolve("mean"));
		Path individual = Files.createDirectories(racine.resolve("individual"));
		registry.add("netcdf.mean.path", () -> mean.toString());
		registry.add("netcdf.individual.path", () -> individual.toString());
	}

	private HttpResponse<String> appeler(String chemin) {
		try {
			return HttpClient.newHttpClient().send(
					HttpRequest.newBuilder(URI.create("http://localhost:" + port + chemin)).build(),
					HttpResponse.BodyHandlers.ofString());
		} catch (Exception e) {
			throw new IllegalStateException("Appel de " + chemin + " impossible", e);
		}
	}

	private void porteLesEnTetes(HttpResponse<String> r, String contexte) {
		var h = r.headers();
		assertThat(h.firstValue("X-Content-Type-Options")).as("%s : nosniff", contexte)
				.hasValue("nosniff");
		assertThat(h.firstValue("X-Frame-Options")).as("%s : X-Frame-Options", contexte)
				.hasValue("DENY");
		assertThat(h.firstValue("Referrer-Policy")).as("%s : Referrer-Policy", contexte)
				.hasValue("no-referrer");
		assertThat(h.firstValue("Content-Security-Policy")).as("%s : CSP", contexte)
				.isPresent();
		assertThat(h.firstValue("Content-Security-Policy").orElse(""))
				.as("%s : la CSP doit rester restrictive", contexte)
				.contains("default-src 'self'")
				.contains("object-src 'none'")
				.contains("frame-ancestors 'none'");
	}

	@Test
	@DisplayName("une reponse d'API normale porte les en-tetes de securite")
	void apiNormale() {
		porteLesEnTetes(appeler("/api/catalog"), "GET /api/catalog");
	}

	/**
	 * Le cas qui justifie le fichier. Une erreur sort par un chemin different
	 * (resolution d'exception, puis eventuellement re-dispatch vers /error) :
	 * rien ne garantit a priori qu'elle repasse par le meme filtre.
	 */
	@Test
	@DisplayName("une reponse d'ERREUR porte les memes en-tetes")
	void reponseErreur() {
		HttpResponse<String> r = appeler("/api/data/slice?dataset=inexistant&variable=TT");
		assertThat(r.statusCode()).isGreaterThanOrEqualTo(400);
		porteLesEnTetes(r, "erreur 4xx sur /api/data/slice");
	}

	@Test
	@DisplayName("un 404 sur une ressource inexistante les porte aussi")
	void quatreCentQuatre() {
		HttpResponse<String> r = appeler("/api/inexistant.json");
		assertThat(r.statusCode()).isEqualTo(404);
		porteLesEnTetes(r, "404 /api/inexistant.json");
	}

	/**
	 * Le filtre ne doit pas etre limite a {@code /api/*} : la coquille React est
	 * ce que charge le navigateur, donc c'est elle qui a besoin de la CSP et de
	 * {@code frame-ancestors}. Un enregistrement restreint a l'API laisserait
	 * la page elle-meme sans politique.
	 */
	@Test
	@DisplayName("la route SPA porte les en-tetes, pas seulement l'API")
	void routeSpa() {
		porteLesEnTetes(appeler("/slice"), "route SPA /slice");
	}

	/**
	 * {@code CacheControlFilter} decide par chemin. Une route SPA porte un nom
	 * stable, donc elle doit rester {@code no-cache} : sans cela, un visiteur
	 * deja venu ne recoit jamais un deploiement.
	 */
	@Test
	@DisplayName("une route SPA reste no-cache, sinon un deploiement n'atteint personne")
	void routeSpaNonMiseEnCache() {
		String cache = appeler("/slice").headers().firstValue("Cache-Control").orElse("");
		assertThat(cache).as("la coquille SPA ne doit pas etre figee chez le visiteur")
				.contains("no-cache");
	}

	/**
	 * L'en-tete que Tomcat ajoute de lui-meme et qui nomme le serveur. Il n'aide
	 * personne et indique la version a qui cherche une faille connue.
	 */
	@Test
	@DisplayName("la reponse ne nomme pas le serveur ni sa version")
	void pasDeSignatureServeur() {
		var h = appeler("/api/catalog").headers();
		assertThat(h.firstValue("Server")).as("en-tete Server").isEmpty();
		assertThat(h.firstValue("X-Powered-By")).as("en-tete X-Powered-By").isEmpty();
	}

	/**
	 * Appel avec un en-tete Accept impose, pour observer la negociation de
	 * contenu telle que Tomcat et Spring MVC la font reellement.
	 */
	private HttpResponse<String> appelerAvecAccept(String chemin, String accept) {
		try {
			return HttpClient.newHttpClient().send(
					HttpRequest.newBuilder(URI.create("http://localhost:" + port + chemin))
							.header("Accept", accept).build(),
					HttpResponse.BodyHandlers.ofString());
		} catch (Exception e) {
			throw new IllegalStateException("Appel de " + chemin + " impossible", e);
		}
	}

	/**
	 * La coquille SPA et les deux documents SEO sont servis par des controleurs
	 * depuis qu'ils portent l'adresse publique du site. Un controleur qui
	 * declare {@code produces} fait dependre sa reponse de l'en-tete Accept :
	 * un moniteur qui demande {@code application/json} obtient alors une
	 * HttpMediaTypeNotAcceptableException, que le catch-all du
	 * GlobalExceptionHandler transforme en <b>500</b>. L'application affirmerait
	 * avoir plante alors qu'elle va bien, et une supervision se declencherait.
	 *
	 * <p>Le gestionnaire de ressources statiques, lui, servait ces pages quel
	 * que soit l'Accept. C'est ce comportement qu'on exige de conserver.
	 *
	 * <p>Ce defaut ne se voit qu'ici : un test unitaire appelle la methode du
	 * controleur directement et ne traverse jamais la negociation.
	 */
	@Test
	@DisplayName("les pages servies ne dependent pas de l'en-tete Accept du client")
	void acceptIndifferent() {
		String[] accepts = {
			"text/html,application/xhtml+xml",
			"application/json",
			"text/plain",
			"*/*",
		};
		for (String chemin : new String[] { "/", "/index.html", "/slice", "/sitemap.xml", "/robots.txt" }) {
			for (String accept : accepts) {
				HttpResponse<String> r = appelerAvecAccept(chemin, accept);
				assertThat(r.statusCode())
						.as("GET %s avec Accept: %s", chemin, accept)
						.isEqualTo(200);
				assertThat(r.body())
						.as("GET %s avec Accept: %s doit rendre un corps", chemin, accept)
						.isNotEmpty();
			}
		}
	}

	/**
	 * Le jeton d'adresse publique de index.html est substitue par le
	 * controleur. S'il survit, la page s'affiche normalement et seules les
	 * balises invisibles sont abimees : personne ne le remarque avant que
	 * l'indexation ne parte de travers.
	 */
	@Test
	@DisplayName("aucune page servie ne laisse passer le jeton d'adresse publique")
	void jetonJamaisServi() {
		for (String chemin : new String[] { "/", "/index.html", "/slice",
				"/index.html?__WB_REVISION__=abc" }) {
			assertThat(appeler(chemin).body())
					.as("GET %s", chemin)
					.doesNotContain("__SITE_URL__");
		}
	}
}
