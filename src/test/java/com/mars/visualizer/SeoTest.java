package com.mars.visualizer;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import com.mars.visualizer.controller.IndexHtmlController;
import com.mars.visualizer.controller.SeoController;
import com.mars.visualizer.service.SiteUrlService;

/**
 * L'adresse publique du site et les trois documents qui en dependent.
 *
 * <p>Ces objets n'ont besoin d'aucun contexte Spring : ils se construisent a la
 * main avec la valeur de propriete voulue, ce qui permet de couvrir en quelques
 * millisecondes des cas qu'un contexte complet demanderait de rejouer avec une
 * configuration differente a chaque fois.
 */
class SeoTest {

	private static MockHttpServletRequest requete(String schema, String hote, int port) {
		MockHttpServletRequest r = new MockHttpServletRequest();
		r.setScheme(schema);
		r.setServerName(hote);
		r.setServerPort(port);
		return r;
	}

	private static int compter(String texte, String motif) {
		int n = 0;
		int i = texte.indexOf(motif);
		while (i >= 0) {
			n++;
			i = texte.indexOf(motif, i + motif.length());
		}
		return n;
	}

	@Nested
	@DisplayName("Resolution de l'adresse")
	class Resolution {

		@Test
		@DisplayName("La propriete configuree fait autorite sur l'origine de la requete")
		void configureeGagne() {
			SiteUrlService s = new SiteUrlService("https://mars.exemple.be");
			assertTrue(s.estConfiguree());
			assertEquals("https://mars.exemple.be",
					s.resoudre(requete("http", "autre-hote.local", 8080)));
		}

		@Test
		@DisplayName("Sans propriete, l'adresse vient de la requete")
		void repliSurLaRequete() {
			SiteUrlService s = new SiteUrlService("");
			assertFalse(s.estConfiguree());
			assertEquals("https://mars.institution.be",
					s.resoudre(requete("https", "mars.institution.be", 443)));
		}

		@Test
		@DisplayName("Le port implicite du schema n'est pas ecrit, un port explicite l'est")
		void portImplicite() {
			SiteUrlService s = new SiteUrlService("");
			assertEquals("http://hote", s.resoudre(requete("http", "hote", 80)));
			assertEquals("https://hote", s.resoudre(requete("https", "hote", 443)));
			assertEquals("http://hote:8080", s.resoudre(requete("http", "hote", 8080)));
			assertEquals("https://hote:80", s.resoudre(requete("https", "hote", 80)));
		}

		@Test
		@DisplayName("Les slashs finaux sont retires, y compris multiples")
		void slashsFinaux() {
			assertEquals("https://mars.exemple.be",
					new SiteUrlService("https://mars.exemple.be///")
							.resoudre(requete("http", "x", 80)));
		}

		@Test
		@DisplayName("Les espaces autour de la valeur sont ignores")
		void espaces() {
			assertEquals("https://mars.exemple.be",
					new SiteUrlService("  https://mars.exemple.be  ")
							.resoudre(requete("http", "x", 80)));
			assertFalse(new SiteUrlService("   ").estConfiguree());
		}

		@Test
		@DisplayName("Une valeur sans protocole empeche le demarrage")
		void sansProtocole() {
			IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
					() -> new SiteUrlService("mars.exemple.be"));
			assertTrue(e.getMessage().contains("mars.exemple.be"), e.getMessage());
			assertTrue(e.getMessage().contains("site.public-url"), e.getMessage());
			assertThrows(IllegalArgumentException.class,
					() -> new SiteUrlService("ftp://mars.exemple.be"));
			assertThrows(IllegalArgumentException.class,
					() -> new SiteUrlService("//mars.exemple.be"));
		}

		@Test
		@DisplayName("Une valeur nulle vaut absence, pas une erreur")
		void valeurNulle() {
			assertFalse(new SiteUrlService(null).estConfiguree());
		}
	}

	@Nested
	@DisplayName("sitemap.xml")
	class Sitemap {

		private String rendre(String configuree) {
			var r = new SeoController(new SiteUrlService(configuree))
					.sitemap(requete("https", "deduit.exemple.be", 443));
			// Le type est pose sur la reponse et non negocie : on le verifie ici,
			// un sitemap servi en text/plain ne serait pas lu par un robot.
			assertEquals("application/xml;charset=UTF-8", String.valueOf(r.getHeaders().getContentType()));
			return r.getBody();
		}

		@Test
		@DisplayName("Toutes les URL sont absolues et portent l'adresse configuree")
		void urlsAbsolues() {
			String xml = rendre("https://mars.exemple.be");
			List<String> locs = new ArrayList<>();
			Matcher m = Pattern.compile("<loc>([^<]+)</loc>").matcher(xml);
			while (m.find()) {
				locs.add(m.group(1));
			}
			assertEquals(SeoController.ROUTES.size(), locs.size());
			assertTrue(locs.contains("https://mars.exemple.be/"), locs.toString());
			for (String loc : locs) {
				assertTrue(loc.startsWith("https://mars.exemple.be"), loc);
				assertFalse(loc.substring("https://".length()).contains("//"),
						"double slash dans " + loc);
			}
		}

		@Test
		@DisplayName("Sans configuration, les URL portent l'hote de la requete")
		void deduitDeLaRequete() {
			String xml = rendre("");
			assertTrue(xml.contains("<loc>https://deduit.exemple.be/</loc>"), xml);
			assertFalse(xml.contains("localhost"), xml);
		}

		@Test
		@DisplayName("Le document est un sitemap complet et bien forme")
		void formeDuDocument() {
			String xml = rendre("https://mars.exemple.be");
			assertTrue(xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"), xml);
			assertTrue(xml.contains("xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\""));
			assertTrue(xml.trim().endsWith("</urlset>"));
			assertEquals(compter(xml, "<url>"), compter(xml, "</url>"));
			assertEquals(SeoController.ROUTES.size(), compter(xml, "<priority>"));
		}

		@Test
		@DisplayName("Aucune route dupliquee")
		void pasDeDoublon() {
			assertEquals(SeoController.ROUTES.size(),
					SeoController.ROUTES.keySet().stream().distinct().count());
		}
	}

	@Nested
	@DisplayName("robots.txt")
	class Robots {

		@Test
		@DisplayName("La ligne Sitemap porte une URL absolue")
		void ligneSitemap() {
			String txt = new SeoController(new SiteUrlService("https://mars.exemple.be"))
					.robots(requete("http", "x", 80)).getBody();
			assertTrue(txt.contains("Sitemap: https://mars.exemple.be/sitemap.xml"), txt);
		}

		@Test
		@DisplayName("L'API reste hors indexation, adresse deduite comprise")
		void apiExclue() {
			String txt = new SeoController(new SiteUrlService(""))
					.robots(requete("https", "mars.exemple.be", 443)).getBody();
			assertTrue(txt.contains("Disallow: /api/"), txt);
			assertTrue(txt.contains("User-agent: *"), txt);
			assertTrue(txt.contains("Sitemap: https://mars.exemple.be/sitemap.xml"), txt);
		}
	}

	@Nested
	@DisplayName("index.html")
	class IndexHtml {

		@Test
		@DisplayName("Le jeton __SITE_URL__ ne survit jamais dans la page servie")
		void jetonRemplace() {
			var reponse = new IndexHtmlController(new SiteUrlService("https://mars.exemple.be"))
					.index(requete("http", "x", 80));
			assertEquals("text/html;charset=UTF-8", String.valueOf(reponse.getHeaders().getContentType()));
			String html = reponse.getBody();
			assertFalse(html.contains("__SITE_URL__"), "jeton non substitue dans index.html");
			assertTrue(html.contains("https://mars.exemple.be/"), "adresse absente de la page");
		}

		@Test
		@DisplayName("Sans configuration, la page porte l'adresse de la requete")
		void adresseDeduite() {
			String html = new IndexHtmlController(new SiteUrlService(""))
					.index(requete("https", "mars.institution.be", 443)).getBody();
			assertFalse(html.contains("__SITE_URL__"));
			assertTrue(html.contains("https://mars.institution.be/"), "adresse deduite absente");
		}

		@Test
		@DisplayName("Deux hotes differents recoivent chacun la leur")
		void deuxHotes() {
			IndexHtmlController c = new IndexHtmlController(new SiteUrlService(""));
			String a = c.index(requete("https", "un.exemple.be", 443)).getBody();
			String b = c.index(requete("https", "deux.exemple.be", 443)).getBody();
			assertTrue(a.contains("https://un.exemple.be/"));
			assertTrue(b.contains("https://deux.exemple.be/"));
			assertFalse(b.contains("un.exemple.be"), "reponse d'un autre hote resservie");
		}

		@Test
		@DisplayName("La meme adresse rend exactement la meme page")
		void cacheStable() {
			IndexHtmlController c =
					new IndexHtmlController(new SiteUrlService("https://mars.exemple.be"));
			assertEquals(c.index(requete("http", "x", 80)).getBody(),
					c.index(requete("http", "y", 80)).getBody());
		}

		@Test
		@DisplayName("La substitution tient au-dela de la borne du cache")
		void cacheBorne() {
			IndexHtmlController c = new IndexHtmlController(new SiteUrlService(""));
			for (int i = 0; i < 200; i++) {
				String html = c.index(requete("https", "hote" + i + ".exemple.be", 443)).getBody();
				assertTrue(html.contains("https://hote" + i + ".exemple.be/"),
						"substitution perdue au-dela de la borne du cache");
			}
		}
	}

	@Nested
	@DisplayName("Les routes du sitemap suivent le routeur React")
	class RoutesEnPhase {

		/**
		 * Le sitemap redit une liste qui vit dans App.jsx. Une page ajoutee la-bas
		 * et oubliee ici ne serait jamais proposee a l'indexation, et rien ne le
		 * signalerait. On compare donc les deux sources au lieu de faire confiance
		 * a un commentaire.
		 */
		@Test
		@DisplayName("Meme ensemble de chemins des deux cotes")
		void memeEnsemble() throws Exception {
			Path app = Path.of("frontend", "src", "App.jsx");
			assertTrue(Files.exists(app),
					"App.jsx introuvable a " + app.toAbsolutePath()
							+ " : ce test doit tourner depuis la racine du depot");
			String source = Files.readString(app, StandardCharsets.UTF_8);

			List<String> reactRoutes = new ArrayList<>();
			Matcher m = Pattern.compile("<Route path=\"([^\"]+)\"").matcher(source);
			while (m.find()) {
				String chemin = m.group(1);
				if (!"*".equals(chemin)) {
					reactRoutes.add(chemin);
				}
			}
			assertFalse(reactRoutes.isEmpty(), "aucune <Route> lue dans App.jsx");

			List<String> manquantes = reactRoutes.stream()
					.filter(r -> !SeoController.ROUTES.containsKey(r)).toList();
			List<String> enTrop = SeoController.ROUTES.keySet().stream()
					.filter(r -> !reactRoutes.contains(r)).toList();

			assertTrue(manquantes.isEmpty(), "routes React absentes du sitemap : " + manquantes);
			assertTrue(enTrop.isEmpty(),
					"routes du sitemap qui n'existent plus dans App.jsx : " + enTrop);
		}
	}
}
