package com.mars.visualizer;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

import ucar.ma2.ArrayDouble;
import ucar.ma2.ArrayFloat;
import ucar.ma2.DataType;
import ucar.nc2.Attribute;
import ucar.nc2.write.NetcdfFormatWriter;

/**
 * Ce que l'API doit refuser, et ce qu'elle ne doit jamais laisser filtrer.
 *
 * <p>Les tests de securite existants couvraient le limiteur de debit et les
 * en-tetes de reponse. Restaient sans aucune verification les trois surfaces
 * qu'un visiteur anonyme peut atteindre directement : le parametre {@code
 * dataset}, qui finit en chemin de fichier ; le corps des erreurs, qui est
 * construit a partir d'arguments applicatifs ; et la politique CORS, dont la
 * valeur par defaut vise le serveur de developpement.
 *
 * <p>Le principe suivi ici : un refus doit etre <b>lisible</b> (un code de
 * statut juste, un message i18n) et <b>muet</b> (aucune information sur la
 * machine qui heberge). Les deux moities comptent autant l'une que l'autre —
 * un 500 qui affiche l'arborescence du serveur renseigne un attaquant bien
 * mieux qu'un 404.
 *
 * <p>Le jeu de donnees est synthetique, comme dans
 * {@link ApiEndpointsIntegrationTest} : un fichier MEAN valide, et un fichier
 * INDIVIDUAL volontairement <b>corrompu</b> (zero octet). Le second n'est pas
 * un caprice : c'est le seul moyen de declencher l'{@code IOException} de
 * lecture sur un chemin absolu, donc de mettre l'API face au cas ou elle a le
 * plus de choses a dire et le moins le droit de les dire.
 */
@SpringBootTest
class SecuriteApiTest {

	private static final String FICHIER = "MY35_Ls000_030_secu.nc";
	private static final String DATASET = "MY35_Ls000_030_secu";

	/** Racine temporaire, memorisee pour verifier qu'elle ne fuit dans aucun corps. */
	private static Path racineTemporaire;

	@Autowired
	private WebApplicationContext contexte;

	private MockMvc mvc;

	private MockMvc mvc() {
		if (mvc == null) {
			mvc = MockMvcBuilders.webAppContextSetup(contexte).build();
		}
		return mvc;
	}

	@DynamicPropertySource
	static void donneesDeTest(DynamicPropertyRegistry registry) throws Exception {
		racineTemporaire = Files.createTempDirectory("mcv-securite");
		racineTemporaire.toFile().deleteOnExit();
		Path mean = Files.createDirectories(racineTemporaire.resolve("mean"));
		Path individual = Files.createDirectories(racineTemporaire.resolve("individual"));
		ecrireMiniGemMars(mean.resolve(FICHIER));

		// Un repertoire individuel au nom numerique, contenant un .nc VIDE :
		// le catalogue le referencera (il ne lit que le nom du fichier pour en
		// deduire Ls), mais l'ouverture echouera. C'est exactement le chemin
		// d'erreur qui portait le chemin absolu du serveur jusqu'au client.
		Path bloc = Files.createDirectories(individual.resolve("000001"));
		Files.writeString(bloc.resolve("hl-b274_000000p_ls010_0000.nc"), "");

		registry.add("netcdf.mean.path", () -> mean.toString());
		registry.add("netcdf.individual.path", () -> individual.toString());
	}

	/** Une GEM-Mars miniature valide : 4 pas de temps, 2 altitudes, 3 lat, 4 lon. */
	private static void ecrireMiniGemMars(Path chemin) throws Exception {
		final int nt = 4;
		final int na = 2;
		final int nlat = 3;
		final int nlon = 4;
		NetcdfFormatWriter.Builder b = NetcdfFormatWriter.createNewNetcdf3(chemin.toString());
		b.addDimension("time", nt);
		b.addDimension("altitudeT", na);
		b.addDimension("lat", nlat);
		b.addDimension("lon", nlon);
		b.addVariable("TT", DataType.FLOAT, "time altitudeT lat lon")
				.addAttribute(new Attribute("units", "K"));
		b.addVariable("MTSF", DataType.FLOAT, "time lat lon")
				.addAttribute(new Attribute("units", "K"));
		b.addVariable("lat", DataType.DOUBLE, "lat");
		b.addVariable("lon", DataType.DOUBLE, "lon");
		b.addVariable("altitudeT", DataType.DOUBLE, "altitudeT");
		b.addVariable("time", DataType.DOUBLE, "time");

		try (NetcdfFormatWriter w = b.build()) {
			ArrayFloat.D4 tt = new ArrayFloat.D4(nt, na, nlat, nlon);
			for (int t = 0; t < nt; t++) {
				for (int a = 0; a < na; a++) {
					for (int y = 0; y < nlat; y++) {
						for (int x = 0; x < nlon; x++) {
							tt.set(t, a, y, x, 200f + t + a + y + x);
						}
					}
				}
			}
			w.write(w.findVariable("TT"), tt);

			ArrayFloat.D3 mtsf = new ArrayFloat.D3(nt, nlat, nlon);
			for (int t = 0; t < nt; t++) {
				for (int y = 0; y < nlat; y++) {
					for (int x = 0; x < nlon; x++) {
						mtsf.set(t, y, x, 210f + t + y + x);
					}
				}
			}
			w.write(w.findVariable("MTSF"), mtsf);

			w.write(w.findVariable("lat"), axe(new double[] { -60, 0, 60 }));
			w.write(w.findVariable("lon"), axe(new double[] { -180, -90, 0, 90 }));
			w.write(w.findVariable("altitudeT"), axe(new double[] { 10, 20 }));
			w.write(w.findVariable("time"), axe(new double[] { 0, 0.5, 1.0, 1.5 }));
		}
	}

	private static ArrayDouble.D1 axe(double[] valeurs) {
		ArrayDouble.D1 a = new ArrayDouble.D1(valeurs.length);
		for (int i = 0; i < valeurs.length; i++) {
			a.set(i, valeurs[i]);
		}
		return a;
	}

	/** Le corps de la reponse, quel que soit son code de statut. */
	private String corps(String url, Object... params) throws Exception {
		var requete = get(url);
		for (int i = 0; i < params.length; i += 2) {
			requete = requete.param(String.valueOf(params[i]), String.valueOf(params[i + 1]));
		}
		MvcResult r = mvc().perform(requete).andReturn();
		return r.getResponse().getContentAsString();
	}

	// =========================================================================
	// Traversee de chemin
	// =========================================================================

	@Nested
	@DisplayName("le parametre dataset ne doit jamais designer un fichier hors des donnees")
	class TraverseeDeChemin {

		/**
		 * Les identifiants MEAN sont valides par liste blanche : {@code
		 * getFilenameById} cherche l'identifiant dans le catalogue construit au
		 * demarrage. Une chaine de traversee n'y figure pas, donc la question ne
		 * se pose meme pas — mais c'est une propriete a verrouiller, pas a
		 * supposer : le jour ou quelqu'un remplace la recherche par une
		 * concatenation, seul ce test le dira.
		 */
		@Test
		@DisplayName("un dataset avec ../ est refuse et rien n'est lu")
		void datasetAvecTraverseeEstRefuse() throws Exception {
			for (String tentative : new String[] {
					"../../../../etc/passwd",
					"..%2F..%2Fetc%2Fpasswd",
					"....//....//etc/passwd",
					"/etc/passwd",
					"C:/Windows/win.ini",
					"mean/../../../secret",
			}) {
				MvcResult r = mvc().perform(get("/api/data/slice")
						.param("dataset", tentative)
						.param("variable", "TT")
						.param("time", "0")
						.param("altitude", "0")).andReturn();
				int statut = r.getResponse().getStatus();
				assertThat(statut)
						.as("« %s » ne doit jamais etre servi", tentative)
						.isIn(400, 404);
			}
		}

		/**
		 * Le prefixe INDIVIDUAL passe par une expression reguliere ancree
		 * ({@code matches}, pas {@code find}) : tout ce qui n'est pas
		 * {@code IND_MY<entier>_LS<decimal>} est rejete avant toute resolution.
		 */
		@Test
		@DisplayName("un identifiant IND_ malforme est refuse par le motif, pas par le disque")
		void identifiantIndividuelMalformeEstRefuse() throws Exception {
			for (String tentative : new String[] {
					"IND_MY34_LS10/../../etc/passwd",
					"IND_MY34_LS../..",
					"IND_MY-1_LS10",
					"IND_MY34_LS999",
					"IND_MY99999999999999999999_LS10",
			}) {
				MvcResult r = mvc().perform(get("/api/data/slice")
						.param("dataset", tentative)
						.param("variable", "TT")).andReturn();
				assertThat(r.getResponse().getStatus())
						.as("« %s » doit etre refuse", tentative)
						.isIn(400, 404);
			}
		}

		/**
		 * Le catalogue MEAN est la liste blanche, donc un identifiant valide en
		 * fait forcement partie : ce test verifie l'autre moitie de la
		 * propriete, sans laquelle la precedente ne prouverait rien (une API qui
		 * refuse tout refuse aussi les traversees).
		 *
		 * <p>{@code assertPathSafe}, la barriere de dernier recours, a ses
		 * propres tests dans {@code NetCDFReaderServiceTest} : elle est
		 * accessible depuis le paquet {@code service}, pas d'ici.
		 */
		@Test
		@DisplayName("l'identifiant legitime du catalogue, lui, est bien servi")
		void identifiantLegitimeEstServi() throws Exception {
			mvc().perform(get("/api/data/slice")
					.param("dataset", DATASET)
					.param("variable", "TT")
					.param("time", "0")
					.param("altitude", "0"))
					.andExpect(status().isOk());
		}
	}

	// =========================================================================
	// Divulgation d'informations
	// =========================================================================

	@Nested
	@DisplayName("aucune reponse d'erreur ne decrit la machine qui heberge")
	class PasDeDivulgation {

		/** Les marqueurs qui trahissent une arborescence ou une pile Java. */
		private void niChemin_niPile(String corps, String contexte) {
			assertThat(corps).as("%s : chemin absolu du serveur", contexte)
					.doesNotContain(racineTemporaire.toString());
			assertThat(corps).as("%s : separateur d'arborescence Unix", contexte)
					.doesNotContain("/home/").doesNotContain("/var/").doesNotContain("/opt/");
			assertThat(corps).as("%s : arborescence Windows", contexte)
					.doesNotContain("C:\\Users").doesNotContain("C:/Users");
			assertThat(corps).as("%s : trace d'exception", contexte)
					.doesNotContain("java.lang.").doesNotContain("com.mars.visualizer")
					.doesNotContain("at org.springframework").doesNotContain("Caused by");
		}

		/**
		 * Le cas qui a motive ce fichier. Un jeu INDIVIDUAL est resolu en
		 * <b>chemin absolu</b> ; si l'ouverture echoue, {@code readFile} enveloppe
		 * l'{@code IOException} en passant ce chemin comme argument du message
		 * i18n, et {@code GlobalExceptionHandler} renvoie ce message tel quel
		 * dans le corps du 500. Un fichier tronque ou un disque reseau qui
		 * bronche suffit donc a publier l'arborescence complete du serveur.
		 */
		@Test
		@DisplayName("une lecture qui echoue sur un jeu INDIVIDUAL ne publie pas le chemin du serveur")
		void lectureIndividuelleEchoueeNePubliePasLeChemin() throws Exception {
			MvcResult r = mvc().perform(get("/api/data/slice")
					.param("dataset", "IND_MY34_LS10.0").param("variable", "TT")
					.param("time", "0").param("altitude", "0")).andReturn();
			String c = r.getResponse().getContentAsString();

			// Sans cette premiere assertion, le test serait VIDE : si la requete
			// etait rejetee plus tot (identifiant refuse, catalogue vide), il
			// passerait sans jamais atteindre la ligne qui fuyait. On exige donc
			// d'abord la preuve qu'on est bien dans le cas d'echec de LECTURE,
			// puis seulement ensuite que le chemin n'y figure pas.
			assertThat(r.getResponse().getStatus())
					.as("le fichier est corrompu : on doit atteindre l'echec de lecture")
					.isEqualTo(500);
			assertThat(c)
					.as("le nom du fichier reste, seule l'arborescence disparait")
					.contains("hl-b274_000000p_ls010_0000.nc");
			niChemin_niPile(c, "slice sur un fichier individuel corrompu");
		}

		@Test
		@DisplayName("un profil vertical qui echoue ne publie pas le chemin non plus")
		void profilIndividuelEchoueNePubliePasLeChemin() throws Exception {
			String c = corps("/api/data/profile",
					"dataset", "IND_MY34_LS10.0", "variable", "TT",
					"time", "0", "latitude", "0", "longitude", "0");
			niChemin_niPile(c, "profil sur un fichier individuel corrompu");
		}

		@Test
		@DisplayName("un export CSV qui echoue ne publie pas le chemin non plus")
		void exportIndividuelEchoueNePubliePasLeChemin() throws Exception {
			String c = corps("/api/export/csv/slice",
					"dataset", "IND_MY34_LS10.0", "variable", "TT", "time", "0", "altitude", "0");
			niChemin_niPile(c, "export CSV sur un fichier individuel corrompu");
		}

		@Test
		@DisplayName("un dataset inexistant renvoie 404 sans nommer de repertoire")
		void datasetInexistantResteMuet() throws Exception {
			String c = corps("/api/data/slice", "dataset", "n_existe_pas", "variable", "TT");
			niChemin_niPile(c, "dataset inexistant");
		}

		/**
		 * Le gestionnaire generique existe justement pour cela : quelle que soit
		 * l'exception inattendue, le client recoit {@code error.generic} et rien
		 * d'autre. La verification porte donc sur une entree volontairement
		 * absurde, pour laquelle aucune branche metier n'est prevue.
		 */
		@Test
		@DisplayName("un parametre de type invalide renvoie 400 sans nommer la classe attendue")
		void typeInvalideResteMuet() throws Exception {
			String c = corps("/api/data/slice",
					"dataset", DATASET, "variable", "TT", "time", "pas-un-entier");
			niChemin_niPile(c, "time non numerique");
			assertThat(c).doesNotContain("NumberFormatException").doesNotContain("Integer");
		}

		@Test
		@DisplayName("les erreurs de validation restent muettes elles aussi")
		void validationResteMuette() throws Exception {
			niChemin_niPile(corps("/api/data/slice",
					"dataset", DATASET, "variable", "TT", "time", "999"), "timestep hors bornes");
			niChemin_niPile(corps("/api/data/slice",
					"dataset", DATASET, "variable", "INEXISTANTE"), "variable inconnue");
			niChemin_niPile(corps("/api/data/timeseries",
					"dataset", DATASET, "variable", "TT", "latitude", "999", "longitude", "0"),
					"latitude hors bornes");
		}
	}

	// =========================================================================
	// Injection dans les en-tetes
	// =========================================================================

	@Nested
	@DisplayName("aucune valeur du client ne se retrouve telle quelle dans un en-tete")
	class InjectionEnTete {

		/**
		 * Le nom de fichier d'un export est bati par {@code String.format} a
		 * partir de {@code dataset}, {@code variable} et {@code type}. Les trois
		 * sont valides par liste blanche <b>avant</b> que le nom soit construit,
		 * donc un retour chariot ne peut pas y arriver — mais c'est une garantie
		 * qui tient a l'ORDRE des instructions, et l'ordre se perd au premier
		 * remaniement. Le test verrouille la propriete, pas l'implementation.
		 */
		@Test
		@DisplayName("un dataset porteur de CRLF ne coupe pas Content-Disposition")
		void crlfDansDatasetNeCoupePasLEnTete() throws Exception {
			MvcResult r = mvc().perform(get("/api/export/csv/slice")
					.param("dataset", "MY35\r\nX-Injecte: oui")
					.param("variable", "TT")).andReturn();

			String disposition = r.getResponse().getHeader("Content-Disposition");
			assertThat(r.getResponse().getHeader("X-Injecte")).isNull();
			if (disposition != null) {
				assertThat(disposition).doesNotContain("\r").doesNotContain("\n");
			}
		}

		@Test
		@DisplayName("un type de coupe invente est refuse avant d'atteindre le nom de fichier")
		void typeInventeEstRefuse() throws Exception {
			mvc().perform(get("/api/export/csv/crosssection")
					.param("dataset", DATASET)
					.param("variable", "TT")
					.param("type", "meridional\r\nSet-Cookie: a=b")
					.param("fixedCoordinate", "0"))
					.andExpect(status().isBadRequest());
		}

		/**
		 * Le nom d'un export legitime doit rester en ASCII : {@code
		 * Content-Disposition} sans encodage RFC 5987 ne transporte rien
		 * d'autre. C'est aussi ce que garantit le {@code Locale.ROOT} applique
		 * aux {@code String.format} de la classe.
		 */
		@Test
		@DisplayName("le nom d'un export legitime est purement ASCII")
		void nomDExportEstAscii() throws Exception {
			MvcResult r = mvc().perform(get("/api/export/csv/slice")
					.param("dataset", DATASET)
					.param("variable", "TT")
					.param("time", "0")
					.param("altitude", "0")).andReturn();
			String disposition = r.getResponse().getHeader("Content-Disposition");
			assertThat(disposition).isNotNull();
			assertThat(disposition).startsWith("attachment;");
			assertThat(disposition.chars().allMatch(c -> c < 128))
					.as("« %s » doit rester en ASCII", disposition)
					.isTrue();
		}
	}

	// =========================================================================
	// CORS
	// =========================================================================

	@Nested
	@DisplayName("la politique CORS n'ouvre pas l'API a n'importe quelle origine")
	class Cors {

		/**
		 * Aucun test ne couvrait {@code CorsConfig}. Le point sensible n'est pas
		 * la liste des methodes mais l'origine : la valeur par defaut vise le
		 * serveur Vite du poste de developpement, et c'est celle qui s'applique
		 * si {@code cors.allowed-origin} n'est pas defini a la mise en service.
		 */
		@Test
		@DisplayName("une origine inconnue n'obtient pas d'autorisation")
		void origineInconnueRefusee() throws Exception {
			MvcResult r = mvc().perform(options("/api/catalog")
					.header("Origin", "https://attaquant.example")
					.header("Access-Control-Request-Method", "GET")).andReturn();

			assertThat(r.getResponse().getHeader("Access-Control-Allow-Origin"))
					.as("aucune origine tierce ne doit etre autorisee")
					.isNotEqualTo("https://attaquant.example")
					.isNotEqualTo("*");
		}

		@Test
		@DisplayName("les methodes d'ecriture ne sont pas negociables")
		void methodesEcritureRefusees() throws Exception {
			MvcResult r = mvc().perform(options("/api/catalog")
					.header("Origin", "http://localhost:5173")
					.header("Access-Control-Request-Method", "DELETE")).andReturn();

			String autorisees = r.getResponse().getHeader("Access-Control-Allow-Methods");
			if (autorisees != null) {
				assertThat(autorisees).doesNotContain("DELETE").doesNotContain("PUT");
			}
		}

		/**
		 * {@code allowCredentials} n'est pas active, et ne doit pas l'etre : rien
		 * dans l'API n'est authentifie, donc autoriser l'envoi des cookies
		 * n'apporterait aucune fonction et ouvrirait la porte a une requete
		 * inter-site portant la session d'un autre service du meme domaine.
		 */
		@Test
		@DisplayName("les identifiants ne circulent pas en inter-origine")
		void pasDIdentifiantsEnInterOrigine() throws Exception {
			MvcResult r = mvc().perform(options("/api/catalog")
					.header("Origin", "http://localhost:5173")
					.header("Access-Control-Request-Method", "GET")).andReturn();
			assertThat(r.getResponse().getHeader("Access-Control-Allow-Credentials"))
					.isNotEqualTo("true");
		}
	}

	// =========================================================================
	// Robustesse des entrees
	// =========================================================================

	@Nested
	@DisplayName("les entrees extremes sont refusees, jamais subies")
	class EntreesExtremes {

		/**
		 * {@code validateLatitude} teste explicitement {@code Double.isNaN}
		 * avant les bornes, car toute comparaison avec NaN est fausse : sans ce
		 * test, {@code NaN < -90} et {@code NaN > 90} valent tous deux faux et
		 * la valeur passe la validation intacte.
		 */
		@Test
		@DisplayName("NaN et l'infini sont refuses sur les coordonnees")
		void nanEtInfiniRefuses() throws Exception {
			for (String valeur : new String[] { "NaN", "Infinity", "-Infinity" }) {
				mvc().perform(get("/api/data/timeseries")
						.param("dataset", DATASET)
						.param("variable", "TT")
						.param("latitude", valeur)
						.param("longitude", "0"))
						.andExpect(status().isBadRequest());
			}
		}

		@Test
		@DisplayName("un entier hors plage est refuse sans faire tomber le serveur")
		void entierHorsPlageRefuse() throws Exception {
			for (String valeur : new String[] { "2147483647", "-2147483648", "99999999999999999999" }) {
				MvcResult r = mvc().perform(get("/api/data/slice")
						.param("dataset", DATASET)
						.param("variable", "TT")
						.param("time", valeur)).andReturn();
				assertThat(r.getResponse().getStatus())
						.as("time=%s", valeur)
						.isEqualTo(400);
			}
		}

		/**
		 * Mesure avant correction : 5 000 caracteres envoyes,
		 * <b>5 100 renvoyes</b>. {@code error.dataset.not.found} recopiait
		 * l'identifiant demande sans borne. Le corps restait du JSON echappe
		 * servi en {@code application/json} avec {@code nosniff}, donc il n'y
		 * avait pas de script a executer — mais un message d'erreur qui repete
		 * l'entiere entree du client n'apprend rien a l'utilisateur (un
		 * identifiant reel fait vingt caracteres) et fait de chaque erreur un
		 * miroir. {@code MessageArgs} borne desormais tout argument textuel.
		 */
		@Test
		@DisplayName("une entree tres longue n'est pas renvoyee en echo")
		void entreeLongueNonRenvoyeeEnEcho() throws Exception {
			String tresLong = "A".repeat(5000);
			String c = corps("/api/data/slice", "dataset", tresLong, "variable", "TT");
			assertThat(c.length()).as("le corps ne doit pas grossir avec l'entree").isLessThan(500);
			assertThat(c).as("l'entree ne doit pas etre recopiee entiere").doesNotContain(tresLong);
		}

		/**
		 * L'autre moitie de la meme regle : la borne ne doit pas rendre le
		 * message inutile. Un identifiant de taille normale reste lisible en
		 * entier, sinon l'utilisateur ne sait plus ce qu'il a demande.
		 */
		@Test
		@DisplayName("un identifiant de taille normale reste lisible en entier")
		void identifiantNormalResteLisible() throws Exception {
			String c = corps("/api/data/slice", "dataset", "mean_MY99_Ls0_30", "variable", "TT");
			assertThat(c).contains("mean_MY99_Ls0_30");
		}

		@Test
		@DisplayName("une charge ressemblant a du script est traitee comme une donnee inconnue")
		void chargeScriptTraiteeCommeDonnee() throws Exception {
			MvcResult r = mvc().perform(get("/api/data/slice")
					.param("dataset", "<script>alert(1)</script>")
					.param("variable", "TT")).andReturn();
			assertThat(r.getResponse().getStatus()).isIn(400, 404);
			// Le corps est du JSON : meme si le texte est repris, il est
			// echappe par Jackson et le type de contenu interdit son execution.
			String type = r.getResponse().getContentType();
			assertThat(type).isNotNull();
			assertThat(type).doesNotContain("text/html");
		}
	}

	// =========================================================================
	// Surface exposee
	// =========================================================================

	@Nested
	@DisplayName("la surface exposee se limite a ce qui est documente")
	class SurfaceExposee {

		/**
		 * Spring Boot expose des points de gestion des qu'{@code actuator} est
		 * au classpath : configuration, variables d'environnement, parfois un
		 * vidage memoire. Il n'y est pas, et il ne doit pas y arriver par
		 * ricochet (une dependance qui le tire transitivement).
		 *
		 * <p>Ces chemins repondent tout de meme 200 : {@code SpaForwardingConfig}
		 * renvoie l'index de l'application pour toute route sans point et hors
		 * {@code /api}, ce qui est le comportement attendu d'une application a
		 * page unique. Ce qui est verifie n'est donc pas le code de statut mais
		 * ce que contient la reponse — la coquille React, jamais un document de
		 * gestion.
		 */
		@Test
		@DisplayName("aucun chemin de gestion ne renvoie de document de configuration")
		void aucunDocumentDeGestion() throws Exception {
			for (String chemin : new String[] {
					"/actuator", "/actuator/env", "/actuator/health",
					"/actuator/beans", "/actuator/configprops", "/actuator/heapdump",
			}) {
				MvcResult r = mvc().perform(get(chemin)).andReturn();
				String type = r.getResponse().getContentType();
				assertThat(type == null || !type.contains("application/json"))
						.as("%s ne doit pas repondre un document JSON de gestion", chemin)
						.isTrue();
				assertThat(r.getResponse().getContentAsString())
						.as("%s ne doit rien publier de la configuration", chemin)
						.doesNotContain("systemProperties")
						.doesNotContain("netcdf.mean.path")
						.doesNotContain("\"contexts\"");
			}
		}

		/**
		 * Les reponses de donnees ne doivent pas etre mises en cache par un
		 * intermediaire partage sans que l'application l'ait decide : c'est
		 * {@code AbstractDataController} qui pose {@code Cache-Control}, et un
		 * export porte {@code no-store} parce qu'il peut contenir une extraction
		 * ciblee que rien ne justifie de conserver sur un proxy.
		 */
		@Test
		@DisplayName("un export n'est pas conserve par un intermediaire")
		void exportNonConserve() throws Exception {
			MvcResult r = mvc().perform(get("/api/export/csv/slice")
					.param("dataset", DATASET)
					.param("variable", "TT")
					.param("time", "0")
					.param("altitude", "0")).andReturn();
			assertThat(r.getResponse().getHeader("Cache-Control")).contains("no-store");
		}
	}
}
