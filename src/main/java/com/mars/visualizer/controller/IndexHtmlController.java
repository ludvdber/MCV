package com.mars.visualizer.controller;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mars.visualizer.service.SiteUrlService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Sert {@code index.html} en y injectant l'adresse publique du site.
 *
 * <p>Le fichier construit par Vite porte cinq occurrences du jeton
 * {@code __SITE_URL__} : le lien canonique, {@code og:url}, {@code og:image},
 * {@code twitter:image} et l'objet schema.org. Vite les laissait autrefois
 * remplies d'une adresse figee au build ; elles sont maintenant completees
 * ici, a partir de {@link SiteUrlService}.
 *
 * <p>Pourquoi passer par un controleur plutot que laisser le gestionnaire de
 * ressources statiques faire son travail : parce que ces cinq balises sont les
 * seules que les robots d'indexation et les generateurs d'apercu de lien
 * lisent SANS executer le JavaScript. Le reste des metadonnees est deja mis a
 * jour par React a chaque changement de route, mais un robot qui ne rend pas
 * la page ne voit que ce que le serveur a envoye.
 *
 * <p>Le resultat est mis en cache par adresse resolue. Le cache est borne :
 * l'adresse peut venir de l'en-tete {@code Host} quand la propriete n'est pas
 * configuree, et une entree par hote demande ferait grossir la carte au gre
 * des requetes. Au-dela de la borne, la substitution est refaite a chaque fois,
 * ce qui coute une copie de cinq kilo-octets, pas une fuite de memoire.
 *
 * <p>Les routes de la SPA arrivent ici par le {@code forward:/index.html} de
 * {@code SpaForwardingConfig} : un forward repasse par le DispatcherServlet,
 * donc {@code /slice} recoit le meme document complete que {@code /}.
 */
@RestController
public class IndexHtmlController {

	private static final String JETON = "__SITE_URL__";
	private static final String RESSOURCE = "static/index.html";

	/** Au-dela, on cesse de memoriser plutot que de laisser la carte grossir. */
	private static final int MAX_ENTREES = 8;

	private final SiteUrlService siteUrl;
	private final Map<String, String> cache = new ConcurrentHashMap<>();

	/** Lu une seule fois : le fichier ne change pas pendant la vie du processus. */
	private volatile String gabarit;

	public IndexHtmlController(SiteUrlService siteUrl) {
		this.siteUrl = siteUrl;
	}

	/**
	 * Pas de `produces` sur la correspondance, volontairement : il ferait
	 * dependre la reponse de l'en-tete Accept du client. Un moniteur qui
	 * demande application/json recevrait alors une
	 * HttpMediaTypeNotAcceptableException, que le @ExceptionHandler(Exception)
	 * du GlobalExceptionHandler transforme en 500 : l'application affirmerait
	 * avoir plante alors qu'elle va bien. Le gestionnaire de ressources
	 * statiques servait cette page quel que soit l'Accept ; on garde ce
	 * comportement et on pose le type de contenu sur la reponse.
	 */
	@GetMapping({ "/", "/index.html" })
	public ResponseEntity<String> index(HttpServletRequest requete) {
		String base = siteUrl.resoudre(requete);
		String rendu = cache.get(base);
		if (rendu == null) {
			rendu = gabarit().replace(JETON, base);
			if (cache.size() < MAX_ENTREES) {
				cache.put(base, rendu);
			}
		}
		return ResponseEntity.ok()
				.contentType(MediaType.valueOf("text/html;charset=UTF-8"))
				.body(rendu);
	}

	/**
	 * Absence du fichier = frontend non construit. C'est une erreur de
	 * deploiement, pas une requete invalide : on la nomme au lieu de servir une
	 * page vide qui ferait chercher ailleurs.
	 */
	private String gabarit() {
		String local = gabarit;
		if (local != null) {
			return local;
		}
		synchronized (this) {
			if (gabarit == null) {
				ClassPathResource fichier = new ClassPathResource(RESSOURCE);
				if (!fichier.exists()) {
					throw new IllegalStateException(
							"Interface introuvable dans le JAR (" + RESSOURCE + ") : "
							+ "le frontend n'a pas ete construit. Lancer ./gradlew build.");
				}
				try (InputStream flux = fichier.getInputStream()) {
					gabarit = new String(flux.readAllBytes(), StandardCharsets.UTF_8);
				} catch (IOException e) {
					throw new IllegalStateException("Lecture impossible de " + RESSOURCE, e);
				}
			}
			return gabarit;
		}
	}
}
