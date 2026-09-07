package com.mars.visualizer.config;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

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
				refuse(response, "Export rate limit exceeded. Max " + maxExportPerMinute + " exports per minute.");
				log.warn("Export rate limit exceeded for IP: {} on {}", sanitize(ip), sanitize(path));
				return;
			}
		}

		CompteurGlissant counter = counters.computeIfAbsent(ip, k -> new CompteurGlissant(now));

		if (counter.autorise(now, maxRequestsPerMinute)) {
			chain.doFilter(request, response);
		} else {
			refuse(response, "Rate limit exceeded. Max " + maxRequestsPerMinute + " requests per minute.");
			log.warn("Rate limit exceeded for IP: {} on {}", sanitize(ip), sanitize(path));
		}

		// Cleanup stale entries (> 2 fenetres) when maps grow beyond 100 IPs
		purge(counters, now);
		purge(exportCounters, now);
	}

	/**
	 * Reponse 429. L'en-tete {@code Retry-After} est ce qui distingue un refus
	 * exploitable d'un refus opaque : sans lui, un client correct n'a aucun moyen
	 * de savoir quand reessayer et repart en boucle serree (RFC 9110, 15.5.30).
	 */
	private void refuse(ServletResponse response, String message) throws IOException {
		HttpServletResponse httpResp = (HttpServletResponse) response;
		httpResp.setStatus(429);
		// Le jeu de caracteres doit etre explicite. Sans lui, le conteneur
		// applique le defaut de la specification servlet (ISO-8859-1) et
		// annonce « application/json;charset=ISO-8859-1 », alors que JSON est
		// defini en UTF-8 (RFC 8259). Invisible tant que le message reste en
		// ASCII, faux des qu'il ne l'est plus.
		httpResp.setContentType("application/json;charset=UTF-8");
		httpResp.setHeader("Retry-After", String.valueOf(FENETRE_MS / 1000));
		httpResp.getWriter().write("{\"error\":\"Too Many Requests\",\"message\":\"" + message + "\"}");
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
