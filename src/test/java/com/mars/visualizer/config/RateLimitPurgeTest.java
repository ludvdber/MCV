package com.mars.visualizer.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import com.mars.visualizer.config.RateLimitFilter.CompteurGlissant;

import jakarta.servlet.ServletException;

/**
 * Ce que coute le menage du limiteur de debit, requete par requete.
 *
 * <p>{@code RateLimitFilter} garde un compteur par adresse IP dans deux cartes
 * et les nettoie avec un {@code removeIf} declenche des que la carte depasse
 * cent entrees. Ce nettoyage etait appele <b>a chaque requete</b>, sur les deux
 * cartes.
 *
 * <p>Le detail qui transforme cela en probleme : une entree n'est oubliee
 * qu'apres deux fenetres d'inactivite. Tant qu'un balayage garde plus de cent
 * adresses vivantes, la carte ne redescend jamais sous le seuil, donc le
 * parcours integral ne s'arrete jamais non plus. Chaque visiteur legitime paie
 * alors la traversee des deux cartes, et il la paie d'autant plus cher que le
 * balayage est large. C'est une amplification discrete : l'attaquant ne sature
 * pas le quota, il alourdit le chemin de tout le monde.
 *
 * <p>Le test mesure le cout marginal d'une requete selon la taille de la carte.
 * Le seuil est volontairement large — l'objet est de detecter un cout qui
 * grandit avec le nombre d'adresses vues, pas de chiffrer des nanosecondes.
 */
class RateLimitPurgeTest {

	/** Un filtre configure large, pour que rien ne soit refuse pendant la mesure. */
	private RateLimitFilter filtre() {
		RateLimitFilter f = new RateLimitFilter(null, null);
		ReflectionTestUtils.setField(f, "maxRequestsPerMinute", 1_000_000);
		ReflectionTestUtils.setField(f, "maxExportPerMinute", 1_000_000);
		return f;
	}

	@SuppressWarnings("unchecked")
	private Map<String, CompteurGlissant> carte(RateLimitFilter f, String champ) {
		return (Map<String, CompteurGlissant>) ReflectionTestUtils.getField(f, champ);
	}

	/** Une requete API venant de l'adresse donnee. */
	private void appeler(RateLimitFilter f, String ip) throws IOException, ServletException {
		MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/catalog");
		req.setRemoteAddr(ip);
		f.doFilter(req, new MockHttpServletResponse(), new MockFilterChain());
	}

	/**
	 * Prepare un filtre dont la carte contient deja {@code n} adresses.
	 *
	 * <p>Les compteurs sont inseres directement plutot qu'obtenus par {@code n}
	 * requetes : {@code CompteurGlissant} est visible dans ce paquet, et
	 * remplir la carte en une passe evite de faire dependre la mesure du cout
	 * du remplissage lui-meme.
	 *
	 * @param n     nombre d'adresses connues
	 * @param recul age des compteurs, en millisecondes
	 */
	private RateLimitFilter avecAdresses(int n, long recul) {
		RateLimitFilter f = filtre();
		long depart = System.currentTimeMillis() - recul;
		Map<String, CompteurGlissant> compteurs = carte(f, "counters");
		for (int i = 0; i < n; i++) {
			compteurs.put("10." + (i / 65536 % 256) + "." + (i / 256 % 256) + "." + (i % 256),
					new CompteurGlissant(depart));
		}
		return f;
	}

	/**
	 * Cout d'une requete d'une meme adresse, en nanosecondes : le MINIMUM de
	 * trois tours.
	 *
	 * <p>Le minimum, et non la moyenne. Une machine partagee — un executeur
	 * d'integration continue en particulier — ne rend jamais une requete plus
	 * RAPIDE qu'elle ne l'est ; elle la ralentit, par preemption ou par
	 * voisinage bruyant. La moyenne absorbe donc tout le bruit de la machine,
	 * alors que le minimum estime ce que le code coute reellement. C'est ce qui
	 * distingue un test de performance utilisable en CI d'un test qui clignote.
	 */
	private long coutParRequete(RateLimitFilter f, int repetitions) throws IOException, ServletException {
		long meilleur = Long.MAX_VALUE;
		for (int tour = 0; tour < 3; tour++) {
			meilleur = Math.min(meilleur, unTour(f, repetitions));
		}
		return meilleur;
	}

	/** Un tour de mesure : chauffe, collecte, puis chronometre. */
	private long unTour(RateLimitFilter f, int repetitions) throws IOException, ServletException {
		for (int i = 0; i < 200; i++) {
			appeler(f, "192.0.2.1");
		}
		// Sans cette collecte, la mesure compte le mauvais phenomene : les
		// 20 000 compteurs viennent d'etre alloues, ils sont donc JEUNES, et
		// chaque collecte mineure declenchee par la boucle de mesure doit les
		// recopier. Le cout observe suivait alors la taille de la carte sans
		// que le filtre y soit pour rien. En production ces compteurs sont
		// vieux depuis longtemps et ne sont plus recopies : les promouvoir ici
		// remet la mesure en face de ce qu'on veut mesurer.
		System.gc();
		long debut = System.nanoTime();
		for (int i = 0; i < repetitions; i++) {
			appeler(f, "192.0.2.1");
		}
		return (System.nanoTime() - debut) / repetitions;
	}

	/**
	 * Les compteurs sont crees a l'instant courant : ils sont donc tous ACTIFS,
	 * et aucun ne sera supprime par le menage. C'est le cas defavorable, et
	 * c'est le cas reel d'un balayage en cours.
	 */
	@Test
	@DisplayName("le cout d'une requete ne croit pas avec le nombre d'adresses deja vues")
	void coutConstantQuelleQueSoitLaTailleDeLaCarte() throws Exception {
		long petite = coutParRequete(avecAdresses(150, 0), 3000);
		long grande = coutParRequete(avecAdresses(15_000, 0), 3000);

		assertThat(grande)
				.as("15 000 adresses connues ne doivent pas alourdir la requete suivante "
						+ "(mesure : %d ns avec 150 adresses, %d ns avec 15 000)", petite, grande)
				.isLessThan(Math.max(petite * 8, 20_000L));
	}

	/**
	 * Le regime au-dessus de la soupape, ou une premiere version du correctif
	 * s'effondrait : elle balayait « tout de suite » des que la carte depassait
	 * le seuil, or des adresses actives ne sont jamais supprimees, donc la carte
	 * restait au-dessus du seuil et le balayage redevenait permanent — mesure
	 * alors : 3 501 balayages pour 7 000 requetes, et 162 us par requete.
	 *
	 * <p>Ce test est celui qui distingue une soupape qui RESSERRE l'intervalle
	 * d'une soupape qui le SUPPRIME. Sans lui, le correctif fautif passait.
	 */
	@Test
	@DisplayName("au-dela de la soupape non plus, le balayage ne redevient pas permanent")
	void soupapeNeDegenerePas() throws Exception {
		long petite = coutParRequete(avecAdresses(150, 0), 3000);
		long enorme = coutParRequete(avecAdresses(60_000, 0), 3000);

		assertThat(enorme)
				.as("60 000 adresses ACTIVES : au pire une passe par seconde, pas une par requete "
						+ "(mesure : %d ns avec 150 adresses, %d ns avec 60 000)", petite, enorme)
				.isLessThan(Math.max(petite * 8, 20_000L));
	}

	/**
	 * L'autre moitie de la propriete, sans laquelle la premiere serait
	 * satisfaite en supprimant le menage : une carte laissee croitre sans limite
	 * echangerait une depense processeur contre une fuite memoire.
	 */
	@Test
	@DisplayName("le menage a bien lieu : les adresses inactives finissent oubliees")
	void menageEffectif() throws Exception {
		// Trois fenetres de recul : bien au-dela des deux que demande la purge.
		RateLimitFilter f = avecAdresses(500, 3 * RateLimitFilter.FENETRE_MS);
		Map<String, CompteurGlissant> compteurs = carte(f, "counters");
		assertThat(compteurs).as("les 500 adresses sont bien enregistrees").hasSize(500);

		// Une seule requete d'une adresse vivante doit suffire a declencher le
		// menage et a emporter les 500 inactives.
		appeler(f, "198.51.100.7");

		assertThat(compteurs)
				.as("apres trois fenetres d'inactivite, seule l'adresse active reste")
				.hasSizeLessThan(50);
	}

	/**
	 * Un menage espace ne doit pas laisser la carte grossir indefiniment entre
	 * deux passages : on verifie qu'apres un flot soutenu, les adresses
	 * anciennes finissent bien par disparaitre.
	 */
	@Test
	@DisplayName("un flot soutenu ne fait pas grossir la carte sans fin")
	void carteBorneeSousFlot() throws Exception {
		RateLimitFilter f = avecAdresses(5_000, 3 * RateLimitFilter.FENETRE_MS);
		Map<String, CompteurGlissant> compteurs = carte(f, "counters");

		for (int i = 0; i < 300; i++) {
			appeler(f, "203.0.113." + (i % 200));
		}

		assertThat(compteurs.size())
				.as("les 5 000 adresses inactives doivent avoir ete oubliees")
				.isLessThan(1_000);
	}
}
