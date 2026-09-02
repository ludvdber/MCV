package com.mars.visualizer.config;

import java.io.IOException;

import org.springframework.stereotype.Component;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Pose l'en-tête {@code Cache-Control} sur les ressources statiques.
 *
 * <p>Vite nomme chaque paquet avec une empreinte de son contenu
 * ({@code plotly-Da7LNxAw.js}) : le fichier ne changera jamais, puisqu'un
 * contenu différent produit un nom différent. Ces fichiers-là peuvent donc être
 * gardés un an. Sans en-tête, le navigateur revalidait les quelque quarante
 * requêtes d'une page à chaque visite, soit un aller-retour chacune.
 *
 * <p>La distinction est toute la difficulté : les fichiers dont le nom est
 * stable, à commencer par {@code index.html} et le service worker, ne doivent
 * surtout pas être gardés, sinon une mise en ligne ne parvient jamais aux
 * navigateurs qui ont déjà visité le site. C'est le défaut classique de ce
 * réglage, et la raison pour laquelle il ne se règle pas d'une seule propriété.
 *
 * <p>Les réponses d'API ne sont pas touchées : elles restent sans en-tête de
 * cache, ce qui est le comportement attendu pour des données scientifiques
 * servies à la demande.
 */
@Component
public class CacheControlFilter implements Filter {

	/** Un an, la valeur maximale recommandée par la RFC 9111. */
	private static final String IMMUTABLE = "public, max-age=31536000, immutable";

	/** Toujours revalider : le nom du fichier ne dit rien de son contenu. */
	private static final String REVALIDATE = "no-cache";

	/** Médias au nom stable mais qui ne changent qu'exceptionnellement. */
	private static final String ONE_WEEK = "public, max-age=604800";

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
			throws IOException, ServletException {

		if (request instanceof HttpServletRequest httpReq && response instanceof HttpServletResponse httpResp) {
			String value = cacheControlFor(httpReq.getRequestURI());
			if (value != null) {
				httpResp.setHeader("Cache-Control", value);
			}
		}

		chain.doFilter(request, response);
	}

	/**
	 * @return la valeur de l'en-tête, ou {@code null} pour ne pas en poser
	 *         (endpoints d'API).
	 */
	public static String cacheControlFor(String uri) {
		if (uri == null || uri.startsWith("/api/")) {
			return null;
		}

		// Noms porteurs d'une empreinte de contenu : immuables par construction.
		// Les polices sont celles de Google Fonts, dont le nom encode déjà la
		// version du fichier.
		if (uri.startsWith("/assets/") || uri.startsWith("/fonts/") || uri.startsWith("/workbox-")) {
			return IMMUTABLE;
		}

		// Noms stables dont le contenu évolue à chaque mise en ligne : ce sont
		// eux qui font découvrir les nouveaux paquets, ils doivent rester frais.
		if (uri.equals("/") || uri.equals("/index.html") || uri.equals("/sw.js")
				|| uri.equals("/registerSW.js") || uri.equals("/theme-init.js")
				|| uri.equals("/manifest.webmanifest") || uri.equals("/robots.txt")
				|| uri.equals("/sitemap.xml")) {
			return REVALIDATE;
		}

		if (uri.endsWith(".png") || uri.endsWith(".webp") || uri.endsWith(".jpg")
				|| uri.endsWith(".svg") || uri.endsWith(".glb") || uri.endsWith(".ttf")) {
			return ONE_WEEK;
		}

		// Route de la SPA (sans extension) : c'est index.html qui sera servi.
		return REVALIDATE;
	}
}
