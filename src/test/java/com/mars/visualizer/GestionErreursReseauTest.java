package com.mars.visualizer;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.lang.reflect.Method;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.apache.catalina.connector.ClientAbortException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.annotation.ExceptionHandlerMethodResolver;

import com.mars.visualizer.exception.GlobalExceptionHandler;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Deux pannes observees sur le serveur reel, l'une derriere l'autre, sur une
 * seule requete : un visiteur ferme son onglet pendant que la page se termine.
 *
 * <pre>
 * ERROR GlobalExceptionHandler : Unexpected: ServletResponse failed to
 *       flushBuffer: java.io.IOException: Broken pipe        (+ 76 lignes)
 * WARN  ExceptionHandlerExceptionResolver : Failure in &#64;ExceptionHandler
 *       ... No converter for [ErrorResponse] with preset
 *       Content-Type 'text/html;charset=UTF-8'
 * </pre>
 *
 * <p>Ce ne sont pas deux symptomes du meme defaut. Le premier est un
 * aiguillage : Spring ENVELOPPE la deconnexion, et le fourre-tout attrape
 * l'enveloppe. Le second est plus general : le gestionnaire insiste pour
 * ecrire un corps sur une reponse DEJA PARTIE, ou ni le statut ni le type de
 * contenu ne peuvent plus changer. Le second survit a la correction du premier
 * pour toute exception levee apres le debut de l'envoi.
 *
 * <p>Note de methode : la premiere version de ce test posait seulement le type
 * de contenu avant de lever, sans rien envoyer. Elle passait deja sur le code
 * fautif, parce qu'une reponse NON envoyee se remet a zero sans difficulte.
 * C'est l'envoi, pas le type de contenu, qui fait la panne.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GestionErreursReseauTest {

	@LocalServerPort
	private int port;

	@DynamicPropertySource
	static void cheminsDonnees(DynamicPropertyRegistry registry) throws IOException {
		Path racine = Files.createTempDirectory("mcv-erreurs-reseau");
		racine.toFile().deleteOnExit();
		Path individuel = Files.createDirectory(racine.resolve("individual"));
		registry.add("netcdf.mean.path", racine::toString);
		registry.add("netcdf.individual.path", individuel::toString);
	}

	/**
	 * Reproduit la situation exacte : une page HTML dont l'envoi a COMMENCE,
	 * comme celui d'IndexHtmlController sur une route SPA, puis une panne.
	 * Ce controleur vit dans les sources de TEST, pas dans l'application.
	 */
	@RestController
	static class PageQuiEchoueApresEnvoi {
		@GetMapping("/_test/page-html-deja-partie")
		public String rendre(HttpServletResponse reponse) throws IOException {
			reponse.setContentType("text/html;charset=UTF-8");
			reponse.getWriter().write("<!doctype html><title>debut</title>");
			reponse.flushBuffer(); // a partir d'ici, plus rien n'est modifiable
			throw new IllegalStateException("panne apres le debut de l envoi");
		}
	}

	@TestConfiguration
	static class Config {
		@Bean
		PageQuiEchoueApresEnvoi pageQuiEchoueApresEnvoi() {
			return new PageQuiEchoueApresEnvoi();
		}
	}

	/** Capte ce que l'application ECRIT dans le journal, qui est le symptome. */
	private ListAppender<ILoggingEvent> journal;
	private ch.qos.logback.classic.Logger racine;

	@BeforeEach
	void brancherLeJournal() {
		racine = (ch.qos.logback.classic.Logger) LoggerFactory.getLogger(
				ch.qos.logback.classic.Logger.ROOT_LOGGER_NAME);
		journal = new ListAppender<>();
		journal.start();
		racine.addAppender(journal);
	}

	@AfterEach
	void debrancherLeJournal() {
		racine.detachAppender(journal);
		journal.stop();
	}

	private List<ILoggingEvent> evenements(Level niveau) {
		return journal.list.stream().filter(e -> e.getLevel().isGreaterOrEqual(niveau)).toList();
	}

	@Nested
	@DisplayName("Un client qui raccroche n est pas une panne du serveur")
	class ClientQuiRaccroche {

		/**
		 * Le gestionnaire avait deja un traitement discret pour
		 * {@link ClientAbortException} : l'intention etait bonne, la cible
		 * incomplete. Tomcat leve bien ClientAbortException, mais Spring
		 * l'ENVELOPPE dans AsyncRequestNotUsableException avant que la
		 * resolution des exceptions ne choisisse une methode, et cette
		 * resolution se fait sur le type LEVE, jamais sur la cause. Le
		 * fourre-tout attrapait donc l'enveloppe, repondait 500 et ecrivait
		 * 76 lignes de trace pour un onglet ferme.
		 */
		@Test
		@DisplayName("l exception que Spring leve reellement va au traitement discret")
		void enveloppeRoutee() {
			var resolveur = new ExceptionHandlerMethodResolver(GlobalExceptionHandler.class);

			Method surEnveloppe = resolveur.resolveMethod(
					new AsyncRequestNotUsableException("ServletResponse failed to flushBuffer",
							new IOException("Broken pipe")));
			Method surCause = resolveur.resolveMethod(
					new ClientAbortException(new IOException("Broken pipe")));

			assertThat(surEnveloppe)
					.as("AsyncRequestNotUsableException doit etre traitee comme une deconnexion,"
							+ " pas comme une erreur interne")
					.isNotNull();
			assertThat(surEnveloppe.getName()).isEqualTo(surCause.getName());
		}

		/**
		 * Le traitement doit rendre {@code void} : la connexion est fermee, il
		 * n'y a plus personne pour lire une reponse. Tenter d'en ecrire une est
		 * precisement ce qui declenche la seconde panne.
		 */
		@Test
		@DisplayName("il n ecrit aucune reponse, puisqu il n y a plus de lecteur")
		void aucuneReponseEcrite() {
			var resolveur = new ExceptionHandlerMethodResolver(GlobalExceptionHandler.class);
			Method m = resolveur.resolveMethod(
					new AsyncRequestNotUsableException("flushBuffer", new IOException("Broken pipe")));
			assertThat(m.getReturnType()).isEqualTo(void.class);
		}

		/** Une deconnexion brutale ne doit rien laisser de casse derriere elle. */
		@Test
		@DisplayName("le serveur repond normalement juste apres une coupure brutale")
		void serveurIntact() throws Exception {
			try (Socket prise = new Socket("localhost", port)) {
				prise.setSoLinger(true, 0); // fermeture par RST, pas par FIN
				prise.getOutputStream().write(
						"GET /slice HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
								.getBytes(StandardCharsets.US_ASCII));
				prise.getOutputStream().flush();
			}
			HttpResponse<String> suivante = HttpClient.newHttpClient().send(
					HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/catalog")).build(),
					HttpResponse.BodyHandlers.ofString());
			assertThat(suivante.statusCode()).isEqualTo(200);
		}
	}

	@Nested
	@DisplayName("Une exception du cadre qui porte son statut ne doit pas passer par le fourre-tout")
	class ExceptionsDuCadre {

		/**
		 * {@code ExceptionHandlerExceptionResolver} s'execute AVANT
		 * {@code DefaultHandlerExceptionResolver} : un
		 * {@code @ExceptionHandler(Exception.class)} prend donc de vitesse
		 * toutes les exceptions du cadre qui portent deja leur statut. Le 405
		 * avait ete traite pour cette raison ; le 406 avait ete oublie, et il
		 * se manifestait de deux facons opposees selon que l'en-tete
		 * {@code Accept} etait lisible ou non.
		 *
		 * <p>Ce test ne verifie pas un cas mais l'ENONCE : aucune requete
		 * malformee, quelle qu'elle soit, ne doit faire dire au serveur qu'il a
		 * plante. Il est ecrit ainsi pour avoir une chance d'attraper la
		 * prochaine de la famille plutot que celle d'hier — la liste ci-dessous
		 * a d'ailleurs ete etablie en balayant un vrai serveur, pas en lisant
		 * la documentation de Spring.
		 */
		@Test
		@DisplayName("aucune requete malformee ne fait dire au serveur qu il a plante")
		void aucunFourreToutSurRequeteMalformee() throws Exception {
			record Cas(String chemin, String accept, int statutAttendu) {}
			var cas = List.of(
					// Format non servi : l'API ne rend que du JSON.
					new Cas("/api/catalog", "text/html", 406),
					new Cas("/api/catalog", "image/png", 406),
					new Cas("/api/catalog", "application/xml", 406),
					// En-tete illisible. Spring se rabat alors sur « tout est
					// acceptable », ce qui permettait au fourre-tout d'ecrire
					// sa reponse : d'ou un 500 la ou le cas precedent donnait
					// un 406 correct, pour la MEME exception.
					new Cas("/api/catalog", "pas-un-type", 406),
					new Cas("/api/catalog", "text/", 406),
					new Cas("/api/catalog", ";;;", 406));

			var client = HttpClient.newHttpClient();
			for (Cas c : cas) {
				HttpResponse<String> r = client.send(
						HttpRequest.newBuilder(URI.create("http://localhost:" + port + c.chemin()))
								.header("Accept", c.accept()).build(),
						HttpResponse.BodyHandlers.ofString());
				assertThat(r.statusCode())
						.as("Accept: %s doit donner %d, pas une panne annoncee",
								c.accept(), c.statutAttendu())
						.isEqualTo(c.statutAttendu());
			}

			assertThat(evenements(Level.ERROR))
					.as("une requete malformee est la faute du client, pas une erreur du serveur")
					.isEmpty();
			assertThat(evenements(Level.WARN))
					.as("et le gestionnaire d erreur ne doit pas echouer en essayant d y repondre")
					.noneMatch(e -> e.getFormattedMessage().contains("Failure in @ExceptionHandler"));
		}
	}

	@Nested
	@DisplayName("La deconnexion arrive emballee, et l emballage varie selon le chemin")
	class DeconnexionEmballee {

		@Autowired
		private GlobalExceptionHandler gestionnaire;

		/**
		 * Releve en forcant l'echec d'ecriture sur une grosse reponse coupee
		 * par RST : sur le chemin API, la deconnexion arrive dans un
		 * HttpMessageNotWritableException de Jackson, et non dans le type que
		 * le journal du site montrait. La resolution de Spring se fait sur le
		 * type LEVE, donc aucune declaration {@code @ExceptionHandler} ne peut
		 * l'attraper : seule la chaine des CAUSES la distingue.
		 *
		 * <p>C'est la difference entre corriger le cas rapporte et corriger le
		 * defaut : le premier echantillon de journal ne contenait que la
		 * variante HTML.
		 */
		@Test
		@DisplayName("une coupure emballee dans une erreur d ecriture JSON reste une coupure")
		void emballageJsonReconnu() {
			var emballee = new HttpMessageNotWritableException(
					"Could not write JSON: ServletOutputStream failed to write",
					new AsyncRequestNotUsableException("ServletOutputStream failed to write",
							new IOException("Connection reset by peer")));

			var reponse = gestionnaire.handleGenericException(emballee, new MockHttpServletResponse());

			assertThat(reponse)
					.as("aucun corps ne doit etre rendu : il n y a plus de lecteur")
					.isNull();
			assertThat(evenements(Level.ERROR))
					.as("un onglet ferme ne doit pas s ecrire en ERROR avec sa trace")
					.isEmpty();
		}

		/** Une VRAIE panne de serialisation, elle, reste une erreur interne. */
		@Test
		@DisplayName("une panne de serialisation sans coupure reste une erreur interne")
		void vraiePanneNonEtouffee() {
			var vraie = new HttpMessageNotWritableException(
					"Could not write JSON", new IllegalStateException("type non serialisable"));

			var reponse = gestionnaire.handleGenericException(vraie, new MockHttpServletResponse());

			assertThat(reponse).isNotNull();
			assertThat(reponse.getStatusCode().value()).isEqualTo(500);
			assertThat(evenements(Level.ERROR))
					.as("etouffer une vraie panne serait pire que le bruit qu on enleve")
					.isNotEmpty();
		}
	}

	@Nested
	@DisplayName("Une panne survenue APRES le debut de l envoi ne doit pas en declencher une seconde")
	class PanneApresEnvoi {

		/**
		 * Une fois l'envoi commence, le statut et le type de contenu sont
		 * figes. Rendre un ErrorResponse revient a demander a Spring d'ecrire
		 * du JSON dans une reponse annoncee en text/html : aucun convertisseur
		 * ne s'applique, le gestionnaire d'exceptions echoue a son tour, et
		 * c'est cette seconde panne qui est apparue en WARN dans le journal.
		 *
		 * <p>La bonne conduite est de renoncer : il n'y a plus de place pour
		 * une reponse d'erreur. On journalise la cause, une fois, et on s'en
		 * tient la.
		 */
		/**
		 * Ce que le client recoit est mesure, et ne peut PAS etre repare : la
		 * connexion se termine en EOF sur une page tronquee. C'est la seule
		 * issue possible une fois l'envoi commence, et ce n'est donc pas le
		 * defaut. Le defaut est ce qui s'ecrit dans le journal a cote.
		 */
		private void appelerEtIgnorerLaCoupure() {
			try {
				HttpClient.newHttpClient().send(
						HttpRequest.newBuilder(
								URI.create("http://localhost:" + port + "/_test/page-html-deja-partie")).build(),
						HttpResponse.BodyHandlers.ofString());
			} catch (IOException | InterruptedException attendu) {
				// Reponse tronquee : inevitable, cf. ci-dessus.
			}
		}

		@Test
		@DisplayName("le gestionnaire d exceptions ne tombe pas a son tour")
		void pasDeSecondePanne() {
			appelerEtIgnorerLaCoupure();

			assertThat(evenements(Level.WARN))
					.as("aucun echec du gestionnaire d exceptions lui-meme ne doit apparaitre")
					.noneMatch(e -> e.getFormattedMessage().contains("Failure in @ExceptionHandler"));
		}

		/** La cause reelle doit rester dans le journal : on renonce, on ne cache pas. */
		@Test
		@DisplayName("la cause reelle est tout de meme journalisee, une fois")
		void causeJournalisee() {
			appelerEtIgnorerLaCoupure();

			assertThat(evenements(Level.ERROR))
					.as("renoncer a repondre ne veut pas dire se taire")
					.anyMatch(e -> e.getThrowableProxy() != null
							&& e.getThrowableProxy().getMessage() != null
							&& e.getThrowableProxy().getMessage().contains("apres le debut de l envoi"));
		}
	}
}
