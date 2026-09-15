package com.mars.visualizer;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import ucar.ma2.ArrayDouble;
import ucar.ma2.ArrayFloat;
import ucar.ma2.DataType;
import ucar.nc2.Attribute;
import ucar.nc2.write.NetcdfFormatWriter;

/**
 * Les huit points d'API que la chaine complete n'exercait pas, plus le chemin
 * INDIVIDUAL de bout en bout.
 *
 * <p>{@code ApiEndpointsIntegrationTest} couvre slice, timeseries, animation,
 * crosssection, tides, wind, altitudes, catalogue MEAN et les exports. Restaient
 * sans aucun test d'integration : {@code /api/catalog/individual},
 * {@code /api/data/profile}, {@code /api/data/temporal-profile},
 * {@code /api/data/zonalmean}, {@code /api/data/hovmoller},
 * {@code /api/data/windrose}, {@code /api/data/transect},
 * {@code /api/data/difference} et {@code /api/health}. Ils avaient des tests de
 * controleur avec un service double : le routage, la validation, la resolution
 * du dataset, la lecture NetCDF partielle et la serialisation n'etaient donc
 * jamais traverses ensemble.
 *
 * <p>Plus grave, AUCUN test d'integration ne passait par un jeu INDIVIDUAL.
 * Tout le chemin {@code IND_MY{annee}_LS{ls}} vers {@code findClosestFile} puis
 * la lecture vivait sur des tests isoles avec des doubles, alors que c'est le
 * chemin qui depend d'une ARBORESCENCE sur le disque et d'une convention de
 * nommage — exactement le genre de chose qu'un double ne peut pas verifier.
 *
 * <p>Chaque cellule encode ses propres indices
 * ({@code 1000*t + 100*alt + 10*latIdx + lonIdx}), donc une valeur lue dans le
 * JSON dit de quelle cellule elle vient : une erreur d'indexation se lit dans le
 * message d'echec au lieu de se deviner. Le second jeu MEAN est le premier
 * DECALE d'une constante, ce qui rend la difference attendue exacte partout.
 */
@SpringBootTest
class ApiEndpointsRestantsIntegrationTest {

	private static final int N_TIME = 8;
	private static final int N_ALT  = 3;
	private static final int N_LAT  = 5;
	private static final int N_LON  = 6;

	private static final double[] LATS = { -80, -40, 0, 40, 80 };
	private static final double[] LONS = { -180, -120, -60, 0, 60, 120 };
	private static final double[] ALTS = { 10, 20, 30 };

	/** Ecart constant entre le jeu B et le jeu A : la difference est donc connue. */
	private static final float DECALAGE = 7f;

	private static final String DATASET_A = "MY35_Ls000_030_restants";
	private static final String DATASET_B = "MY35_Ls030_060_restants";

	/** Le jeu INDIVIDUAL : trois fichiers a Ls 10, 20 et 30 dans un bloc. */
	private static final double[] LS_INDIVIDUELS = { 10.0, 20.0, 30.0 };

	@Autowired
	private WebApplicationContext contexte;

	private MockMvc mvc;

	private MockMvc mvc() {
		if (mvc == null) {
			mvc = MockMvcBuilders.webAppContextSetup(contexte).build();
		}
		return mvc;
	}

	/** La valeur que doit porter la cellule (t, alt, latIdx, lonIdx). */
	private static float attendu(int t, int a, int lat, int lon) {
		return 1000f * t + 100f * a + 10f * lat + lon;
	}

	@DynamicPropertySource
	static void donneesDeTest(DynamicPropertyRegistry registry) throws Exception {
		Path racine = Files.createTempDirectory("mcv-api-restants");
		racine.toFile().deleteOnExit();
		Path mean       = Files.createDirectories(racine.resolve("mean"));
		Path individual = Files.createDirectories(racine.resolve("individual"));

		ecrireMiniGemMars(mean.resolve(DATASET_A + ".nc"), 0f);
		ecrireMiniGemMars(mean.resolve(DATASET_B + ".nc"), DECALAGE);

		// Un bloc INDIVIDUAL : repertoire au nom NUMERIQUE, fichiers au format
		// hl-b274_{seq}p_ls{AAA}_{BBBB}.nc. La convention est ce qui rend le
		// catalogue lisible, donc elle fait partie de ce qu'on teste.
		Path bloc = Files.createDirectories(individual.resolve("000001"));
		int seq = 0;
		for (double ls : LS_INDIVIDUELS) {
			int aaa  = (int) Math.floor(ls);
			int bbbb = (int) Math.round((ls - aaa) * 10000);
			ecrireMiniGemMars(
					bloc.resolve(String.format("hl-b274_%06dp_ls%03d_%04d.nc", seq++, aaa, bbbb)),
					0f);
		}

		registry.add("netcdf.mean.path", () -> mean.toString());
		registry.add("netcdf.individual.path", () -> individual.toString());
	}

	/** Une GEM-Mars miniature, structurellement fidele : 8 x 3 x 5 x 6. */
	private static void ecrireMiniGemMars(Path chemin, float decalage) throws Exception {
		NetcdfFormatWriter.Builder b = NetcdfFormatWriter.createNewNetcdf3(chemin.toString());
		b.addDimension("time", N_TIME);
		b.addDimension("altitudeT", N_ALT);
		b.addDimension("lat", N_LAT);
		b.addDimension("lon", N_LON);

		b.addVariable("TT", DataType.FLOAT, "time altitudeT lat lon")
			.addAttribute(new Attribute("units", "K"))
			.addAttribute(new Attribute("standard_name", "air_temperature"))
			.addAttribute(new Attribute("long_name", "Air temperature"));
		b.addVariable("UU", DataType.FLOAT, "time altitudeT lat lon")
			.addAttribute(new Attribute("units", "m s-1"));
		b.addVariable("VV", DataType.FLOAT, "time altitudeT lat lon")
			.addAttribute(new Attribute("units", "m s-1"));
		b.addVariable("MTSF", DataType.FLOAT, "time lat lon")
			.addAttribute(new Attribute("units", "K"));

		b.addVariable("lat", DataType.DOUBLE, "lat");
		b.addVariable("lon", DataType.DOUBLE, "lon");
		b.addVariable("altitudeT", DataType.DOUBLE, "altitudeT");

		try (NetcdfFormatWriter w = b.build()) {
			ArrayFloat.D4 tt = new ArrayFloat.D4(N_TIME, N_ALT, N_LAT, N_LON);
			ArrayFloat.D4 uu = new ArrayFloat.D4(N_TIME, N_ALT, N_LAT, N_LON);
			ArrayFloat.D4 vv = new ArrayFloat.D4(N_TIME, N_ALT, N_LAT, N_LON);
			for (int t = 0; t < N_TIME; t++) {
				for (int a = 0; a < N_ALT; a++) {
					for (int la = 0; la < N_LAT; la++) {
						for (int lo = 0; lo < N_LON; lo++) {
							float v = attendu(t, a, la, lo) + decalage;
							tt.set(t, a, la, lo, v);
							// Un vent constant en direction : UU positif, VV nul,
							// donc une rose sans ambiguite d'orientation.
							uu.set(t, a, la, lo, 10f + t);
							vv.set(t, a, la, lo, 0f);
						}
					}
				}
			}
			w.write(w.findVariable("TT"), tt);
			w.write(w.findVariable("UU"), uu);
			w.write(w.findVariable("VV"), vv);

			ArrayFloat.D3 mtsf = new ArrayFloat.D3(N_TIME, N_LAT, N_LON);
			for (int t = 0; t < N_TIME; t++) {
				for (int la = 0; la < N_LAT; la++) {
					for (int lo = 0; lo < N_LON; lo++) {
						mtsf.set(t, la, lo, 210f + decalage);
					}
				}
			}
			w.write(w.findVariable("MTSF"), mtsf);

			ArrayDouble.D1 lat = new ArrayDouble.D1(N_LAT);
			for (int i = 0; i < N_LAT; i++) lat.set(i, LATS[i]);
			w.write(w.findVariable("lat"), lat);

			ArrayDouble.D1 lon = new ArrayDouble.D1(N_LON);
			for (int i = 0; i < N_LON; i++) lon.set(i, LONS[i]);
			w.write(w.findVariable("lon"), lon);

			ArrayDouble.D1 alt = new ArrayDouble.D1(N_ALT);
			for (int i = 0; i < N_ALT; i++) alt.set(i, ALTS[i]);
			w.write(w.findVariable("altitudeT"), alt);
		}
	}

	// =========================================================================

	@Nested
	@DisplayName("/api/health")
	class Sante {

		/** La sonde que tout superviseur interrogera en premier. */
		@Test
		@DisplayName("repond 200 et se dit en bonne sante")
		void repond() throws Exception {
			mvc().perform(get("/api/health"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.status").exists());
		}
	}

	@Nested
	@DisplayName("/api/catalog/individual")
	class CatalogueIndividuel {

		/**
		 * Le catalogue INDIVIDUAL se construit en PARCOURANT le disque : un
		 * repertoire au nom numerique, des fichiers dont le nom porte la Ls. Un
		 * test avec un double ne verifie rien de tout cela.
		 */
		@Test
		@DisplayName("expose l annee martienne et sa plage de Ls, lues sur le disque")
		void exposeLAnnee() throws Exception {
			mvc().perform(get("/api/catalog/individual"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$").isArray())
					.andExpect(jsonPath("$.length()").value(1))
					// netcdf.individual.my_base vaut 34 : le premier bloc est MY34.
					.andExpect(jsonPath("$[0].marsYear").value(34))
					.andExpect(jsonPath("$[0].lsMin").value(10.0))
					.andExpect(jsonPath("$[0].lsMax").value(30.0))
					.andExpect(jsonPath("$[0].directories[0]").value("000001"));
		}
	}

	@Nested
	@DisplayName("Chemin INDIVIDUAL de bout en bout")
	class CheminIndividuel {

		/**
		 * Le coeur du trou : un identifiant {@code IND_MY34_LS20} doit traverser
		 * le resolveur, choisir le fichier le plus proche sur le disque, et etre
		 * lu. Rien ne l'avait jamais fait dans une application demarree.
		 */
		@Test
		@DisplayName("une coupe se sert depuis un jeu INDIVIDUAL")
		void coupeIndividuelle() throws Exception {
			mvc().perform(get("/api/data/slice")
							.param("dataset", "IND_MY34_LS20")
							.param("variable", "TT")
							.param("time", "0")
							.param("altitude", "0"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data").isArray())
					.andExpect(jsonPath("$.latitudes.length()").value(N_LAT))
					.andExpect(jsonPath("$.longitudes.length()").value(N_LON))
					// La cellule (t=0, alt=0, latIdx=0, lonIdx=0) porte 0.
					.andExpect(jsonPath("$.data[0][0]").value(attendu(0, 0, 0, 0)))
					.andExpect(jsonPath("$.data[2][3]").value(attendu(0, 0, 2, 3)));
		}

		/**
		 * La Ls demandee et celle du fichier servi different presque toujours :
		 * le catalogue rend le plus proche. L'API doit annoncer celle qu'elle a
		 * REELLEMENT lue, sans quoi la figure porte une legende fausse.
		 */
		@Test
		@DisplayName("la reponse annonce la Ls du fichier reellement servi")
		void annonceLaLsServie() throws Exception {
			mvc().perform(get("/api/data/slice")
							.param("dataset", "IND_MY34_LS22")
							.param("variable", "TT")
							.param("time", "0")
							.param("altitude", "0"))
					.andExpect(status().isOk())
					// Ls 22 demandee, le fichier le plus proche est celui a Ls 20.
					.andExpect(jsonPath("$.actualLs").value(20.0));
		}

		@Test
		@DisplayName("une annee martienne absente est refusee, pas servie au hasard")
		void anneeAbsente() throws Exception {
			mvc().perform(get("/api/data/slice")
							.param("dataset", "IND_MY99_LS20")
							.param("variable", "TT")
							.param("time", "0")
							.param("altitude", "0"))
					.andExpect(status().is4xxClientError());
		}
	}

	@Nested
	@DisplayName("/api/data/profile")
	class Profil {

		/**
		 * Un profil vertical lit UNE colonne : meme instant, meme point, toutes
		 * les altitudes. L'encodage rend la colonne attendue exacte — a
		 * latIdx 2 et lonIdx 2, les trois altitudes valent 22, 122 et 222.
		 */
		@Test
		@DisplayName("lit la colonne verticale du bon point")
		void litLaColonne() throws Exception {
			mvc().perform(get("/api/data/profile")
							.param("dataset", DATASET_A)
							.param("variable", "TT")
							.param("time", "0")
							.param("latitude", "0")      // latIdx 2
							.param("longitude", "-60"))  // lonIdx 2
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.values.length()").value(N_ALT))
					.andExpect(jsonPath("$.altitudes.length()").value(N_ALT))
					.andExpect(jsonPath("$.values[0]").value(attendu(0, 0, 2, 2)))
					.andExpect(jsonPath("$.values[1]").value(attendu(0, 1, 2, 2)))
					.andExpect(jsonPath("$.values[2]").value(attendu(0, 2, 2, 2)))
					.andExpect(jsonPath("$.stats").exists());
		}

		/**
		 * Un point demande entre deux noeuds est servi par le plus proche. La
		 * grille de test a un pas de 40 degres en latitude : 15 tombe entre 0 et
		 * 40, plus pres de 0. Si la resolution se trompait de noeud, la colonne
		 * lue le dirait (latIdx 3 au lieu de 2, soit +10 sur chaque valeur).
		 */
		@Test
		@DisplayName("un point hors noeud est servi par le noeud le plus proche")
		void noeudLePlusProche() throws Exception {
			mvc().perform(get("/api/data/profile")
							.param("dataset", DATASET_A)
							.param("variable", "TT")
							.param("time", "0")
							.param("latitude", "15")
							.param("longitude", "-60"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.values[0]").value(attendu(0, 0, 2, 2)))
					// Et la reponse annonce le NOEUD, pas la demande. Les champs
					// s'appellent latitude/longitude sans le prefixe « actual »,
					// mais ils portent bien le point lu : c'est ce qui evite la
					// legende fausse de quinze degres que le point demande
					// produirait. La nuance ne se voit que si les deux different,
					// d'ou cette requete volontairement entre deux noeuds.
					.andExpect(jsonPath("$.latitude").value(0.0))
					.andExpect(jsonPath("$.longitude").value(-60.0));
		}

		@Test
		@DisplayName("une latitude hors du domaine est refusee")
		void latitudeHorsDomaine() throws Exception {
			mvc().perform(get("/api/data/profile")
							.param("dataset", DATASET_A)
							.param("variable", "TT")
							.param("time", "0")
							.param("latitude", "200")
							.param("longitude", "0"))
					.andExpect(status().isBadRequest());
		}
	}

	@Nested
	@DisplayName("/api/data/temporal-profile")
	class ProfilTemporel {

		/**
		 * Une grille altitude x temps en un point. Les deux dimensions doivent
		 * etre dans cet ordre, sinon le graphe est transpose et personne ne s'en
		 * apercoit tant que les deux tailles sont egales — ici 3 et 8 different,
		 * donc le test le verrait.
		 */
		@Test
		@DisplayName("rend une grille altitude x temps, dans cet ordre")
		void grilleAltitudeTemps() throws Exception {
			mvc().perform(get("/api/data/temporal-profile")
							.param("dataset", DATASET_A)
							.param("variable", "TT")
							.param("latitude", "0")
							.param("longitude", "-60"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.altitudes.length()").value(N_ALT))
					.andExpect(jsonPath("$.times.length()").value(N_TIME))
					.andExpect(jsonPath("$.data.length()").value(N_ALT))
					.andExpect(jsonPath("$.data[0].length()").value(N_TIME))
					// altitude 0, instant 3, point (2,2) : 3000 + 0 + 20 + 2
					.andExpect(jsonPath("$.data[0][3]").value(attendu(3, 0, 2, 2)))
					// altitude 2, instant 0 : 0 + 200 + 20 + 2
					.andExpect(jsonPath("$.data[2][0]").value(attendu(0, 2, 2, 2)));
		}
	}

	@Nested
	@DisplayName("/api/data/zonalmean")
	class MoyenneZonale {

		/**
		 * La moyenne zonale moyenne SUR LES LONGITUDES a latitude fixe. Les
		 * indices de longitude vont de 0 a 5, de moyenne 2,5 : la valeur
		 * attendue en (alt, lat) est donc exactement
		 * {@code 1000*t + 100*alt + 10*latIdx + 2,5}.
		 *
		 * <p>Cette moyenne-la ne doit PAS etre ponderee par le cosinus de la
		 * latitude : on moyenne le long d'un cercle de latitude, ou toutes les
		 * cellules ont le meme poids. Ponderer ici donnerait le meme resultat par
		 * accident (un facteur constant se simplifie), mais l'ecrire fixe
		 * l'intention.
		 */
		@Test
		@DisplayName("moyenne sur les longitudes, a latitude fixe")
		void moyenneSurLesLongitudes() throws Exception {
			mvc().perform(get("/api/data/zonalmean")
							.param("dataset", DATASET_A)
							.param("variable", "TT")
							.param("time", "0"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.latitudes.length()").value(N_LAT))
					.andExpect(jsonPath("$.altitudes.length()").value(N_ALT))
					.andExpect(jsonPath("$.data.length()").value(N_ALT))
					.andExpect(jsonPath("$.data[0].length()").value(N_LAT))
					// alt 0, latIdx 0 : 0 + 0 + 0 + 2,5
					.andExpect(jsonPath("$.data[0][0]").value(2.5))
					// alt 0, latIdx 4 : 40 + 2,5
					.andExpect(jsonPath("$.data[0][4]").value(42.5))
					// alt 2, latIdx 2 : 200 + 20 + 2,5
					.andExpect(jsonPath("$.data[2][2]").value(222.5));
		}
	}

	@Nested
	@DisplayName("/api/data/hovmoller")
	class Hovmoller {

		/**
		 * Un Hovmoller croise l'espace et le temps. Les deux types existent et
		 * n'ont pas la meme taille spatiale ici (5 latitudes contre 6
		 * longitudes) : un type qui rendrait l'autre axe se verrait.
		 */
		@Test
		@DisplayName("type latitude : espace = les 5 latitudes")
		void typeLatitude() throws Exception {
			mvc().perform(get("/api/data/hovmoller")
							.param("dataset", DATASET_A)
							.param("variable", "TT")
							.param("altitude", "0")
							.param("type", "latitude"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.type").value("latitude"))
					.andExpect(jsonPath("$.spatialCoords.length()").value(N_LAT))
					.andExpect(jsonPath("$.times.length()").value(N_TIME))
					.andExpect(jsonPath("$.data").isArray());
		}

		@Test
		@DisplayName("type longitude : espace = les 6 longitudes")
		void typeLongitude() throws Exception {
			mvc().perform(get("/api/data/hovmoller")
							.param("dataset", DATASET_A)
							.param("variable", "TT")
							.param("altitude", "0")
							.param("type", "longitude"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.type").value("longitude"))
					.andExpect(jsonPath("$.spatialCoords.length()").value(N_LON));
		}

		@Test
		@DisplayName("un type inconnu est refuse plutot que replie en silence")
		void typeInconnu() throws Exception {
			mvc().perform(get("/api/data/hovmoller")
							.param("dataset", DATASET_A)
							.param("variable", "TT")
							.param("altitude", "0")
							.param("type", "diagonale"))
					.andExpect(status().is4xxClientError());
		}
	}

	@Nested
	@DisplayName("/api/data/windrose")
	class RoseDesVents {

		/**
		 * La rose lit UU et VV au meme point sur tous les instants. Le champ de
		 * test a un vent purement zonal ({@code VV = 0}) qui force avec le temps
		 * ({@code UU = 10 + t}) : la direction est donc constante et la vitesse
		 * croissante, ce qui rend toute confusion d'axe visible.
		 */
		@Test
		@DisplayName("rend une serie UU et VV par instant, au point demande")
		void serieParInstant() throws Exception {
			mvc().perform(get("/api/data/windrose")
							.param("dataset", DATASET_A)
							.param("latitude", "0")
							.param("longitude", "-60")
							.param("altitude", "0"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.uu.length()").value(N_TIME))
					.andExpect(jsonPath("$.vv.length()").value(N_TIME))
					.andExpect(jsonPath("$.uu[0]").value(10.0))
					.andExpect(jsonPath("$.uu[7]").value(17.0))
					.andExpect(jsonPath("$.vv[0]").value(0.0));
		}

		/**
		 * La rose annonce deja le noeud reellement lu, la ou d'autres points
		 * n'echoaient que la demande. C'est la propriete qui evite une legende
		 * fausse de deux degres, et elle doit tenir.
		 */
		@Test
		@DisplayName("annonce le noeud REELLEMENT lu, pas seulement le point demande")
		void annonceLeNoeudLu() throws Exception {
			mvc().perform(get("/api/data/windrose")
							.param("dataset", DATASET_A)
							.param("latitude", "15")     // entre 0 et 40, plus pres de 0
							.param("longitude", "-60")
							.param("altitude", "0"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.latitude").value(15.0))
					.andExpect(jsonPath("$.actualLat").value(0.0))
					.andExpect(jsonPath("$.actualLon").value(-60.0));
		}
	}

	@Nested
	@DisplayName("/api/data/transect")
	class Transect {

		/**
		 * Un transect echantillonne le long d'un grand cercle. Trois proprietes
		 * le rendent juste : le nombre de points demande est respecte, les
		 * distances croissent strictement, et les extremites tombent sur les
		 * points demandes. Sans la derniere, un transect decale d'un pas passerait
		 * inapercu.
		 */
		@Test
		@DisplayName("echantillonne le nombre de points demande, des extremites vers l autre")
		void echantillonne() throws Exception {
			mvc().perform(get("/api/data/transect")
							.param("dataset", DATASET_A)
							.param("variable", "TT")
							.param("time", "0")
							.param("lat1", "-80").param("lon1", "-180")
							.param("lat2", "80").param("lon2", "120")
							.param("points", "12"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.distances.length()").value(12))
					.andExpect(jsonPath("$.lats.length()").value(12))
					.andExpect(jsonPath("$.lons.length()").value(12))
					.andExpect(jsonPath("$.distances[0]").value(0.0))
					.andExpect(jsonPath("$.lat1").value(-80.0))
					.andExpect(jsonPath("$.lat2").value(80.0))
					.andExpect(jsonPath("$.data").isArray());
		}

		/**
		 * Deux points identiques n'ont pas de grand cercle : le trajet est
		 * degenere. Un double-clic au meme endroit suffit a le produire, donc
		 * c'est une entree ORDINAIRE, pas une bizarrerie. Le serveur la refuse
		 * explicitement plutot que de diviser par une distance nulle et de rendre
		 * une serie de NaN qu'un graphe afficherait comme un trou.
		 */
		@Test
		@DisplayName("un trajet de longueur nulle est refuse explicitement")
		void trajetNul() throws Exception {
			mvc().perform(get("/api/data/transect")
							.param("dataset", DATASET_A)
							.param("variable", "TT")
							.param("time", "0")
							.param("lat1", "0").param("lon1", "0")
							.param("lat2", "0").param("lon2", "0")
							.param("points", "8"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").exists());
		}

		/**
		 * Deux points ANTIPODAUX n'ont pas non plus de grand cercle unique : une
		 * infinite de trajets les relient, et en choisir un silencieusement
		 * reviendrait a inventer une coupe. Le message d'erreur annonce les deux
		 * cas ; ce test verifie que le second est vraiment couvert.
		 */
		@Test
		@DisplayName("un trajet entre deux antipodes est refuse aussi")
		void trajetAntipodal() throws Exception {
			mvc().perform(get("/api/data/transect")
							.param("dataset", DATASET_A)
							.param("variable", "TT")
							.param("time", "0")
							.param("lat1", "40").param("lon1", "0")
							.param("lat2", "-40").param("lon2", "180")
							.param("points", "8"))
					.andExpect(status().isBadRequest());
		}
	}

	@Nested
	@DisplayName("/api/data/difference")
	class Difference {

		/**
		 * Le jeu B est le jeu A decale d'une constante, donc la difference vaut
		 * cette constante PARTOUT. C'est la seule facon de distinguer une
		 * soustraction juste d'une soustraction qui lirait deux fois le meme
		 * fichier, ou qui melangerait les indices : un champ de difference
		 * uniforme mais FAUX serait indiscernable d'un champ juste si les deux
		 * jeux etaient identiques.
		 */
		@Test
		@DisplayName("la difference vaut exactement l ecart entre les deux jeux, partout")
		void ecartConstant() throws Exception {
			mvc().perform(get("/api/data/difference")
							.param("datasetA", DATASET_A)
							.param("datasetB", DATASET_B)
							.param("variable", "TT")
							.param("time", "0")
							.param("altitude", "0"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.length()").value(N_LAT))
					.andExpect(jsonPath("$.data[0].length()").value(N_LON))
					// La convention est A MOINS B. Le jeu B valant A + 7, la
					// difference vaut -7 partout. Le SIGNE est la moitie de
					// l'information d'une carte d'anomalie : l'inverser
					// retournerait chaque lecture sans rien casser d'autre, donc
					// il se fixe ici.
					.andExpect(jsonPath("$.stats.min").value(-DECALAGE))
					.andExpect(jsonPath("$.stats.max").value(-DECALAGE));
		}

		/**
		 * Comparer un jeu avec lui-meme est REFUSE, et c'est un choix, pas un
		 * oubli : un champ nul partout se lirait comme « aucune difference
		 * mesurable entre deux epoques », alors qu'il ne dit que « j'ai soustrait
		 * un fichier de lui-meme ». Les statistiques qui l'accompagneraient
		 * seraient toutes nulles et parfaitement credibles. Mieux vaut un refus
		 * lisible qu'une carte vraie de rien.
		 */
		@Test
		@DisplayName("comparer un jeu avec lui-meme est refuse, pas servi comme un champ nul")
		void memeJeu() throws Exception {
			mvc().perform(get("/api/data/difference")
							.param("datasetA", DATASET_A)
							.param("datasetB", DATASET_A)
							.param("variable", "TT")
							.param("time", "0")
							.param("altitude", "0"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").exists());
		}

		@Test
		@DisplayName("un jeu inexistant est refuse, sans fuite de chemin")
		void jeuInexistant() throws Exception {
			mvc().perform(get("/api/data/difference")
							.param("datasetA", DATASET_A)
							.param("datasetB", "jeu_qui_n_existe_pas")
							.param("variable", "TT")
							.param("time", "0")
							.param("altitude", "0"))
					.andExpect(status().is4xxClientError())
					.andExpect(content().string(org.hamcrest.Matchers.not(
							org.hamcrest.Matchers.containsString("mcv-api-restants"))));
		}
	}
}
