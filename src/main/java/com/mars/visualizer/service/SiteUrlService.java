package com.mars.visualizer.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Adresse publique du site, telle qu'elle doit apparaitre dans les metadonnees
 * lues par les moteurs de recherche : sitemap.xml, robots.txt et les balises
 * canonical / Open Graph / schema.org de index.html.
 *
 * <p>Elle etait autrefois figee a la construction du frontend, ce qui obligeait
 * a reconstruire le JAR pour changer de domaine et faisait voyager une adresse
 * en dur dans le livrable. Elle est desormais resolue a chaque requete, donc
 * elle se regle comme tous les autres parametres : dans le fichier
 * {@code config/application.properties} pose a cote du JAR.
 *
 * <p>Deux sources, dans cet ordre :
 * <ol>
 *   <li>la propriete {@code site.public-url}, qui fait autorite ;</li>
 *   <li>a defaut, l'origine de la requete elle-meme.</li>
 * </ol>
 *
 * <p>Le repli sur la requete n'est pas un pis-aller : derriere un proxy,
 * {@code server.forward-headers-strategy=native} fait deja porter a
 * {@code getScheme()} et {@code getServerName()} les valeurs annoncees par
 * {@code X-Forwarded-Proto} et {@code X-Forwarded-Host}, donc l'adresse
 * obtenue est celle que le visiteur voit. Une installation qui ne configure
 * rien reste ainsi correcte.
 *
 * <p>Renseigner la propriete garde pourtant un interet : elle rend la reponse
 * independante de l'en-tete {@code Host}. Sans elle, un client peut demander
 * un sitemap en annoncant le domaine de son choix et recevoir un document qui
 * le nomme. Cela ne pollue que sa propre reponse (ces deux fichiers sont
 * servis en {@code no-cache}, donc rien ne se partage), mais une valeur fixe
 * supprime la question.
 */
@Service
public class SiteUrlService {

	/** Valeur configuree, deja normalisee ; chaine vide si absente. */
	private final String configuree;

	public SiteUrlService(@Value("${site.public-url:}") String valeur) {
		this.configuree = normaliser(valeur);
	}

	/**
	 * Une valeur sans protocole (« mcv.institution.be ») produirait des liens
	 * canoniques casses, et le defaut ne se verrait que des mois plus tard dans
	 * l'indexation. On refuse donc de demarrer : l'echec est immediat et nomme
	 * la valeur fautive, comme pour un chemin de donnees introuvable.
	 */
	private static String normaliser(String valeur) {
		String v = valeur == null ? "" : valeur.trim();
		if (v.isEmpty()) {
			return "";
		}
		if (!v.startsWith("http://") && !v.startsWith("https://")) {
			throw new IllegalArgumentException(
					"site.public-url doit commencer par http:// ou https:// (recu : \"" + v + "\")");
		}
		while (v.endsWith("/")) {
			v = v.substring(0, v.length() - 1);
		}
		return v;
	}

	/** {@code true} si l'adresse vient de la configuration et non de la requete. */
	public boolean estConfiguree() {
		return !configuree.isEmpty();
	}

	/** Adresse absolue, sans slash final, jamais nulle ni vide. */
	public String resoudre(HttpServletRequest requete) {
		return configuree.isEmpty() ? depuisLaRequete(requete) : configuree;
	}

	/**
	 * Le port n'est ecrit que s'il n'est pas celui du schema : « https://hote »
	 * et non « https://hote:443 », sans quoi chaque URL du sitemap differerait
	 * de celle que le visiteur a dans sa barre d'adresse.
	 */
	private static String depuisLaRequete(HttpServletRequest requete) {
		String schema = requete.getScheme();
		String hote = requete.getServerName();
		int port = requete.getServerPort();
		boolean portImplicite = ("http".equals(schema) && port == 80)
				|| ("https".equals(schema) && port == 443);
		return portImplicite ? schema + "://" + hote : schema + "://" + hote + ":" + port;
	}
}
