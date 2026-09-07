package com.mars.visualizer.config;

import static org.assertj.core.api.Assertions.*;
import static com.mars.visualizer.config.RateLimitFilter.FENETRE_MS;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.mars.visualizer.config.RateLimitFilter.CompteurGlissant;

/**
 * Fenêtre du limiteur de requêtes.
 *
 * <p>Les tests d'intégration existants vérifient qu'au-delà du quota on répond
 * 429, ce qui passait déjà avec une fenêtre fixe. Ce qu'ils ne pouvaient pas
 * voir, c'est la BORDURE : une fenêtre fixe laisse passer deux quotas pleins de
 * part et d'autre de la minute. On ne peut pas l'observer sans faire attendre
 * une minute à la suite de tests, d'où ces tests directs sur la fenêtre, à qui
 * on fournit l'instant.
 */
class RateLimitWindowTest {

	private static final int MAX = 10;

	@Test
	@DisplayName("Le quota est accordé puis refusé dans une fenêtre neuve")
	void quotaSimple() {
		CompteurGlissant c = new CompteurGlissant(0L);
		for (int i = 0; i < MAX; i++) {
			assertThat(c.autorise(0L, MAX)).as("requete %d", i + 1).isTrue();
		}
		assertThat(c.autorise(0L, MAX)).as("la requete au-dela du quota").isFalse();
	}

	@Test
	@DisplayName("La bordure de fenêtre ne laisse plus passer deux quotas d'affilée")
	void bordureNonExploitable() {
		// Le scenario exact que permettait la fenetre fixe : saturer a la fin
		// d'une minute, attendre la bascule, et recommencer aussitot.
		CompteurGlissant c = new CompteurGlissant(0L);
		long finDeFenetre = FENETRE_MS - 1_000;          // a 59 s
		for (int i = 0; i < MAX; i++) {
			assertThat(c.autorise(finDeFenetre, MAX)).isTrue();
		}

		long justeApres = FENETRE_MS + 1_000;            // a 61 s, 2 s plus tard
		int accordes = 0;
		for (int i = 0; i < 20; i++) {
			if (c.autorise(justeApres, MAX)) accordes++;
		}

		// A 61 s, la fenetre precedente pese encore 59/60 : estimation
		// 10 x 0,9833 = 9,83, donc il reste tout juste la place pour UNE requete.
		// C'est le propre d'un quota qui se reconstitue en continu. Une fenetre
		// FIXE en aurait accorde dix, soit un second quota plein en deux secondes.
		assertThat(accordes)
				.as("2 s apres avoir consomme le quota : 1 requete, pas un second quota")
				.isEqualTo(1);
	}

	@Test
	@DisplayName("Le quota se reconstitue progressivement, pas d'un coup")
	void reconstitutionProgressive() {
		CompteurGlissant c = new CompteurGlissant(0L);
		for (int i = 0; i < MAX; i++) {
			assertThat(c.autorise(0L, MAX)).isTrue();
		}

		// A mi-fenetre suivante, la precedente ne pese plus que la moitie :
		// il doit rester environ la moitie du quota.
		long miFenetreSuivante = FENETRE_MS + FENETRE_MS / 2;
		int accordes = 0;
		for (int i = 0; i < 20; i++) {
			if (c.autorise(miFenetreSuivante, MAX)) accordes++;
		}
		assertThat(accordes)
				.as("environ la moitie du quota doit s'etre reconstituee")
				.isBetween(4, 6);
	}

	@Test
	@DisplayName("Après deux fenêtres d'inactivité, le quota est entier")
	void quotaEntierApresInactivite() {
		CompteurGlissant c = new CompteurGlissant(0L);
		for (int i = 0; i < MAX; i++) c.autorise(0L, MAX);

		long bienPlusTard = 3 * FENETRE_MS;
		int accordes = 0;
		for (int i = 0; i < 20; i++) {
			if (c.autorise(bienPlusTard, MAX)) accordes++;
		}
		assertThat(accordes).isEqualTo(MAX);
	}

	@Test
	@DisplayName("Insister sans relâche ne fige pas la fenêtre précédente")
	void insisterNeFigePasLaFenetre() {
		// L'etat doit continuer de glisser meme quand chaque requete est refusee,
		// sinon un client qui martele reste bloque indefiniment.
		CompteurGlissant c = new CompteurGlissant(0L);
		for (int i = 0; i < MAX; i++) c.autorise(0L, MAX);

		for (long t = FENETRE_MS; t < 2 * FENETRE_MS; t += 1_000) {
			c.autorise(t, MAX); // refuse au debut, accepte ensuite
		}
		assertThat(c.autorise(3 * FENETRE_MS, MAX))
				.as("apres deux fenetres, le compteur doit etre repartu a neuf")
				.isTrue();
	}

	@Test
	@DisplayName("Le compte reste exact sous accès concurrent")
	void exactSousConcurrence() throws Exception {
		// L'ancienne version lisait puis ecrivait en deux temps : deux requetes
		// simultanees pouvaient toutes deux reinitialiser la fenetre.
		final int fils = 24;
		final int parFil = 50;
		CompteurGlissant c = new CompteurGlissant(0L);
		AtomicInteger accordes = new AtomicInteger();
		CountDownLatch depart = new CountDownLatch(1);

		try (ExecutorService ex = Executors.newVirtualThreadPerTaskExecutor()) {
			List<Runnable> taches = new ArrayList<>();
			for (int f = 0; f < fils; f++) {
				taches.add(() -> {
					try {
						depart.await();
					} catch (InterruptedException e) {
						Thread.currentThread().interrupt();
						return;
					}
					for (int i = 0; i < parFil; i++) {
						if (c.autorise(0L, 100)) accordes.incrementAndGet();
					}
				});
			}
			taches.forEach(ex::submit);
			depart.countDown();
			ex.shutdown();
			assertThat(ex.awaitTermination(20, TimeUnit.SECONDS)).isTrue();
		}

		assertThat(accordes.get())
				.as("%d fils x %d tentatives sur un quota de 100 : exactement 100 accordees",
						fils, parFil)
				.isEqualTo(100);
	}
}
