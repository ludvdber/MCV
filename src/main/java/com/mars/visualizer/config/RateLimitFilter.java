package com.mars.visualizer.config;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.LocaleResolver;

import java.util.Locale;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

/**
 * Limite le nombre de requetes API par IP et par minute.
 * Repond 429 Too Many Requests au-dela.
 */
@Component
@Slf4j
public class RateLimitFilter implements Filter {

	/** Duree de la fenetre, en millisecondes. */
	static final long FENETRE_MS = 60_000L;

	@Value("${ratelimit.requests-per-minute:120}")
	private int maxRequestsPerMinute;

	@Value("${ratelimit.export-per-minute:20}")
	private int maxExportPerMinute;

	private final Map<String, CompteurGlissant> counters = new ConcurrentHashMap<>();
	private final Map<String, CompteurGlissant> exportCounters = new ConcurrentHashMap<>();

	/**
	 * Instant du dernier menage. Le nettoyage etait lance a CHAQUE requete des
	 * que la carte depassait cent entrees : comme une entree survit deux
	 * fenetres, un balayage large maintient la carte au-dessus du seuil en
	 * permanence, donc le parcours integral ne s'arretait jamais et chaque
	 * visiteur legitime le payait. Mesure sur {@code RateLimitPurgeTest} :
	 * 12 us par requete avec 150 adresses connues, <b>149 us avec 20 000</b>.
	 * Espacer le menage d'une fenetre ramene ce cout a celui d'une recherche
	 * dans une table de hachage, sans rien changer a ce qui est oublie.
	 */
	private final java.util.concurrent.atomic.AtomicLong dernierMenage =
			new java.util.concurrent.atomic.AtomicLong(0L);

	private final MessageSource  messageSource;
	private final LocaleResolver localeResolver;

	public RateLimitFilter(MessageSource messageSource, LocaleResolver localeResolver) {
		this.messageSource  = messageSource;
		this.localeResolver = localeResolver;
	}

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
			throws IOException, ServletException {

		HttpServletRequest httpReq = (HttpServletRequest) request;
		String path = httpReq.getRequestURI();

		// Only rate-limit API endpoints
		if (!path.startsWith("/api/")) {
			chain.doFilter(request, response);
			return;
		}

		String ip = getClientIp(httpReq);
		long now = System.currentTimeMillis();

		// Stricter limit for export endpoints (generate large files)
		if (path.startsWith("/api/export/")) {
			CompteurGlissant exportCounter = exportCounters.computeIfAbsent(ip, k -> new CompteurGlissant(now));
			if (!exportCounter.autorise(now, maxExportPerMinute)) {
				refuse(httpReq, response, "error.ratelimit.exports", maxExportPerMinute);
				log.warn("Export rate limit exceeded for IP: {} on {}", sanitize(ip), sanitize(path));
				return;
			}
		}

		CompteurGlissant counter = counters.computeIfAbsent(ip, k -> new CompteurGlissant(now));

		if (counter.autorise(now, maxRequestsPerMinute)) {
			chain.doFilter(request, response);
		} else {
			refuse(httpReq, response, "error.ratelimit.requests", maxRequestsPerMinute);
			log.warn("Rate limit exceeded for IP: {} on {}", sanitize(ip), sanitize(path));
		}

		menagePeriodique(now);
	}

	/**
	 * Reponse 429. L'en-tete {@code Retry-After} est ce qui distingue un refus
	 * exploitable d'un refus opaque : sans lui, un client correct n'a aucun moyen
	 * de savoir quand reessayer et repart en boucle serree (RFC 9110, 15.5.30).
	 */
	private void refuse(HttpServletRequest request, ServletResponse response,
			String cleMessage, int quota) throws IOException {

		HttpServletResponse httpResp = (HttpServletResponse) response;
		long secondes = FENETRE_MS / 1000;

		// On interroge le LocaleResolver, PAS LocaleContextHolder. Celui-ci est
		// bien rempli ici (le RequestContextFilter de Spring Boot s'execute
		// avant ce filtre), mais il porte le `request.getLocale()` brut, sans
		// passer par la liste des langues acceptees. Or, faute d'en-tete
		// Accept-Language, la specification servlet fait rendre a
		// `getLocale()` la locale par DEFAUT DU SERVEUR : sur une machine belge,
		// un client anonyme recevrait du francais, alors que la langue de repli
		// documentee est l'anglais. Le resolveur, lui, applique LocaleConfig.
		Locale locale = localeResolver.resolveLocale(request);
		String message = messageSource.getMessage(cleMessage,
				new Object[]{quota, secondes}, locale);

		httpResp.setStatus(429);
		// Le jeu de caracteres doit etre explicite. Sans lui, le conteneur
		// applique le defaut de la specification servlet (ISO-8859-1) et
		// annonce « application/json;charset=ISO-8859-1 », alors que JSON est
		// defini en UTF-8 (RFC 8259). Ce message est desormais traduit, donc
		// accentue : le defaut serait visible, plus seulement theorique.
		httpResp.setContentType("application/json;charset=UTF-8");
		httpResp.setHeader("Retry-After", String.valueOf(secondes));
		httpResp.getWriter().write(
				"{\"error\":\"Too Many Requests\",\"message\":\"" + echapperJson(message) + "\"}");
	}

	/**
	 * Echappe une chaine pour l'inserer dans le corps JSON construit a la main.
	 *
	 * <p>Le message venait d'un litteral ASCII ; il vient maintenant d'un fichier
	 * de traduction, que n'importe qui peut modifier. Un guillemet ou une barre
	 * oblique inverse suffirait a produire un JSON invalide, et le client
	 * afficherait « reponse inattendue » au lieu du motif du refus. On ne peut
	 * pas s'appuyer sur Jackson ici : le filtre tourne hors du contexte MVC.
	 */
	private static String echapperJson(String texte) {
		StringBuilder sb = new StringBuilder(texte.length() + 16);
		for (int i = 0; i < texte.length(); i++) {
			char c = texte.charAt(i);
			switch (c) {
				case '"'  -> sb.append("\\\"");
				case '\\' -> sb.append("\\\\");
				case '\n' -> sb.append("\\n");
				case '\r' -> sb.append("\\r");
				case '\t' -> sb.append("\\t");
				default   -> {
					if (c < 0x20) {
						sb.append(String.format(java.util.Locale.ROOT, "\\u%04x", (int) c));
					} else {
						sb.append(c);
					}
				}
			}
		}
		return sb.toString();
	}

	/**
	 * Taille au-dela de laquelle le menage se resserre. Vingt mille compteurs
	 * representent quelques mega-octets : tres au-dessus d'un trafic normal, et
	 * tres en dessous de ce qui inquiete la machine.
	 */
	private static final int TAILLE_DE_SECOURS = 20_000;

	/** Intervalle minimal entre deux balayages quand les cartes ont trop grossi. */
	private static final long INTERVALLE_SERRE_MS = 1_000L;

	/**
	 * Lance le menage au plus une fois par intervalle.
	 *
	 * <p>Deux ecueils sont evites ici, et le second l'a d'abord ete de travers.
	 *
	 * <p>Le premier : balayer a CHAQUE requete. Une entree survit deux fenetres,
	 * donc tant qu'un balayage large garde plus de cent adresses vivantes, la
	 * carte ne redescend jamais sous le seuil de {@code purge} et le parcours
	 * integral ne s'arrete jamais. Mesure : 12 us par requete avec 150 adresses
	 * connues, <b>149 us avec 20 000</b>, a la charge des visiteurs legitimes.
	 *
	 * <p>Le second : une soupape « au-dela de tant d'entrees, balayer tout de
	 * suite » degenere en exactement le meme probleme, un cran plus haut. Si les
	 * adresses sont ACTIVES, {@code purge} n'en supprime aucune, la carte reste
	 * au-dessus du seuil, et la soupape declenche a nouveau a chaque requete —
	 * mesure sur une premiere version de ce correctif : <b>3 501 balayages pour
	 * 7 000 requetes</b>. Une soupape doit donc resserrer l'intervalle, jamais
	 * le supprimer : au pire une passe par seconde, quoi qu'il arrive.
	 *
	 * <p>Le compare-et-echange garantit enfin qu'un seul fil balaie : les autres
	 * passent leur chemin plutot que de refaire le meme parcours, ce qui compte
	 * puisque c'est quand les requetes affluent que le balayage coute le plus.
	 */
	private void menagePeriodique(long now) {
		long precedent = dernierMenage.get();
		boolean trop = counters.size() > TAILLE_DE_SECOURS || exportCounters.size() > TAILLE_DE_SECOURS;
		long intervalle = trop ? INTERVALLE_SERRE_MS : FENETRE_MS;
		if (now - precedent < intervalle) {
			return;
		}
		if (!dernierMenage.compareAndSet(precedent, now)) {
			// Un autre fil s'en charge : ne pas balayer deux fois la meme carte.
			return;
		}
		purge(counters, now);
		purge(exportCounters, now);
	}

	/** Oublie les IP inactives depuis plus de deux fenetres. */
	private static void purge(Map<String, CompteurGlissant> compteurs, long now) {
		if (compteurs.size() <= 100) {
			return;
		}
		compteurs.entrySet().removeIf(e -> now - e.getValue().dernierDebut() > 2 * FENETRE_MS);
	}

	/**
	 * Extracts the client IP used as the rate-limit key.
	 *
	 * <p>Reads {@code getRemoteAddr()} only, and never parses
	 * {@code X-Forwarded-For} here: the whole value of a per-IP limit rests on
	 * that key being something the caller cannot choose.
	 *
	 * <p>Whether {@code getRemoteAddr()} is the socket address or a forwarded
	 * one is decided upstream by Tomcat's {@code RemoteIpValve}
	 * ({@code server.forward-headers-strategy=native}), which rewrites it only
	 * when the connection genuinely comes from a proxy listed in
	 * {@code server.tomcat.remoteip.internal-proxies}, and walks the header
	 * right to left so the proxy's own value wins over anything the client
	 * prepended. A direct caller therefore cannot spoof its IP, and a caller
	 * behind the trusted proxy is still counted individually.
	 *
	 * <p>Do not switch back to {@code framework}: that strategy trusts the
	 * header from any peer and keeps its first, client-supplied value, which
	 * makes this limiter bypassable with a single request header.
	 */
	private String getClientIp(HttpServletRequest request) {
		return request.getRemoteAddr();
	}

	/** Sanitize log input to prevent log injection (strip CR/LF). */
	private static String sanitize(String input) {
		return input == null ? "" : input.replaceAll("[\\r\\n]", " ");
	}

	/**
	 * Fenetre reellement GLISSANTE, ponderee par la fenetre precedente.
	 *
	 * <p>La version precedente etait une fenetre FIXE, alors que sa
	 * documentation annoncait « sliding ». La difference n'est pas cosmetique :
	 * une fenetre fixe laisse passer deux quotas pleins a cheval sur la bordure,
	 * soit 240 requetes en deux secondes pour une limite affichee de 120 par
	 * minute. Il suffisait d'attendre la fin d'une minute.
	 *
	 * <p>On garde donc le compte de la fenetre courante ET celui de la
	 * precedente, et on estime le debit en ponderant la precedente par la part
	 * de fenetre qu'il reste a parcourir. C'est l'approximation classique : une
	 * seule addition, deux entiers par IP, et plus de bordure exploitable.
	 *
	 * <p>L'etat est un enregistrement immuable remplace par comparaison-et-echange.
	 * L'ancien code lisait puis ecrivait en deux temps ({@code if} suivi de
	 * {@code count.set(1)}), si bien que deux requetes simultanees pouvaient
	 * toutes deux reinitialiser la fenetre et perdre un compte.
	 */
	// Visibilite paquet : la logique de fenetre se teste directement, en lui
	// fournissant l'instant, plutot qu'en faisant attendre une minute a un test.
	static final class CompteurGlissant {

		/** @param debut     instant de depart de la fenetre courante
		 *  @param courant   requetes comptees dans la fenetre courante
		 *  @param precedent requetes comptees dans la fenetre d'avant */
		private record Etat(long debut, int courant, int precedent) {}

		private final AtomicReference<Etat> etat;

		CompteurGlissant(long now) {
			this.etat = new AtomicReference<>(new Etat(now, 0, 0));
		}

		/** Instant de depart de la fenetre courante, pour la purge. */
		long dernierDebut() {
			return etat.get().debut();
		}

		boolean autorise(long now, int max) {
			while (true) {
				Etat actuel = etat.get();
				Etat base = faireGlisser(actuel, now);

				double partEcoulee = Math.min(1.0, (double) (now - base.debut()) / FENETRE_MS);
				double estimation = base.precedent() * (1.0 - partEcoulee) + base.courant();

				if (estimation >= max) {
					// Le glissement doit etre memorise meme sur un refus, sinon la
					// fenetre precedente ne vieillit jamais tant que l'IP insiste.
					if (base != actuel && !etat.compareAndSet(actuel, base)) {
						continue;
					}
					return false;
				}
				Etat suivant = new Etat(base.debut(), base.courant() + 1, base.precedent());
				if (etat.compareAndSet(actuel, suivant)) {
					return true;
				}
				// Un autre fil a gagne : on recommence sur l'etat a jour.
			}
		}

		/** Avance l'etat jusqu'a la fenetre qui contient {@code now}. */
		private static Etat faireGlisser(Etat e, long now) {
			long ecoule = now - e.debut();
			if (ecoule < FENETRE_MS) {
				return e;
			}
			if (ecoule < 2 * FENETRE_MS) {
				return new Etat(e.debut() + FENETRE_MS, 0, e.courant());
			}
			return new Etat(now, 0, 0);
		}
	}
}
