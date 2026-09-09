package com.mars.visualizer.controller;

import java.time.LocalDate;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.service.SiteUrlService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Sert {@code sitemap.xml} et {@code robots.txt}.
 *
 * <p>Ces deux fichiers etaient produits par Vite au moment du build, ce qui
 * gravait l'adresse du site dans le JAR. Les servir ici les rend
 * configurables sans reconstruire, et surtout corrects par defaut : quand
 * {@code site.public-url} n'est pas renseignee, {@link SiteUrlService} deduit
 * l'adresse de la requete, donc le sitemap nomme toujours le domaine qui l'a
 * servi. Le cas « pas de sitemap parce qu'on ignore l'adresse » n'existe plus.
 *
 * <p>{@code CacheControlFilter} envoie deja {@code no-cache} sur ces deux
 * chemins : une reponse construite pour un hote ne peut donc pas etre resservie
 * pour un autre.
 */
@RestController
public class SeoController {

	/**
	 * Routes publiques indexables et leur priorite.
	 *
	 * <p>Cette liste double le routeur React ({@code frontend/src/App.jsx}) :
	 * une page ajoutee la-bas et oubliee ici ne serait jamais proposee a
	 * l'indexation, en silence. {@code SeoTest.RoutesEnPhase} lit App.jsx et
	 * echoue si les deux listes divergent.
	 *
	 * <p>Publique et non modifiable : le test la lit depuis un autre paquet, et
	 * une carte mutable exposee laisserait n'importe quel appelant la vider.
	 */
	public static final Map<String, String> ROUTES;
	static {
		Map<String, String> routes = new LinkedHashMap<>();
		routes.put("/", "1.0");
		routes.put("/explore", "0.9");
		routes.put("/slice", "0.7");
		routes.put("/animation", "0.7");
		routes.put("/timeseries", "0.6");
		routes.put("/profile", "0.6");
		routes.put("/crosssection", "0.6");
		routes.put("/hovmoller", "0.6");
		routes.put("/zonalmean", "0.6");
		routes.put("/windrose", "0.6");
		routes.put("/difference", "0.6");
		routes.put("/temporal-profile", "0.6");
		routes.put("/legal", "0.2");
		ROUTES = Collections.unmodifiableMap(routes);
	}

	private final SiteUrlService siteUrl;

	public SeoController(SiteUrlService siteUrl) {
		this.siteUrl = siteUrl;
	}

	/** Voir IndexHtmlController pour la raison de l'absence de `produces`. */
	@GetMapping("/sitemap.xml")
	public ResponseEntity<String> sitemap(HttpServletRequest requete) {
		String base = siteUrl.resoudre(requete);
		// La date du jour ferait varier le document a chaque appel sans qu'aucun
		// contenu n'ait bouge ; celle du demarrage decrirait la mise en ligne.
		// On prend la date du jour, comme le faisait le build : elle reste une
		// approximation honnete d'une donnee qui evolue avec le catalogue.
		String jour = LocalDate.now().toString();
		StringBuilder xml = new StringBuilder(1024);
		xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
		   .append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
		for (Map.Entry<String, String> route : ROUTES.entrySet()) {
			xml.append("  <url>\n")
			   .append("    <loc>").append(base).append(route.getKey()).append("</loc>\n")
			   .append("    <lastmod>").append(jour).append("</lastmod>\n")
			   .append("    <changefreq>monthly</changefreq>\n")
			   .append("    <priority>").append(route.getValue()).append("</priority>\n")
			   .append("  </url>\n");
		}
		return ResponseEntity.ok()
				.contentType(MediaType.valueOf("application/xml;charset=UTF-8"))
				.body(xml.append("</urlset>\n").toString());
	}

	@GetMapping("/robots.txt")
	/** Voir IndexHtmlController pour la raison de l'absence de `produces`. */
	public ResponseEntity<String> robots(HttpServletRequest requete) {
		String txt = "User-agent: *\n"
				+ "Allow: /\n"
				+ "\n"
				+ "Sitemap: " + siteUrl.resoudre(requete) + "/sitemap.xml\n"
				+ "\n"
				+ "# API endpoints should not be indexed\n"
				+ "Disallow: /api/\n"
				+ "Disallow: /swagger-ui\n"
				+ "Disallow: /api-docs\n";
		return ResponseEntity.ok()
				.contentType(MediaType.valueOf("text/plain;charset=UTF-8"))
				.body(txt);
	}
}
