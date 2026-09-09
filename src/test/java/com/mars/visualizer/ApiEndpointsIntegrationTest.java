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
 * Les six points d'API que rien n'exercait.
 *
 * <p>Mesure de couverture avant : {@code SliceController} 6 %,
 * {@code TidesController} 8 %, {@code CrossSectionController} 10 %,
 * {@code AnimationController} 24 %, {@code TimeSeriesController} 26 %. Ils
 * n'etaient verifies que par une sonde HTTP lancee a la main contre le serveur
 * vivant, avec les vraies donnees : sur un clone frais, rien ne les touchait.
 *
 * <p>Le blocage suppose etait « il faut de vrais fichiers NetCDF ». Il n'existe
 * pas : {@code NetcdfFormatWriter}, deja present dans cdm-core, ecrit une
 * GEM-Mars miniature dans un dossier temporaire vers lequel pointe
 * {@code netcdf.mean.path}. Le test traverse alors toute la chaine reelle,
 * routage, validation, resolution du dataset, lecture partielle du NetCDF,
 * statistiques ponderees, serialisation Jackson et en-tetes de cache.
 *
 * <p>Chaque cellule encode ses indices ({@code 1000*t + 100*alt + 10*lat + lon}),
 * donc une valeur lue dans le JSON dit d'ou elle vient.
 */
@SpringBootTest
class ApiEndpointsIntegrationTest {

	private static final int N_TIME = 8;
	private static final int N_ALT  = 3;
	private static final int N_LAT  = 5;
	private static final int N_LON  = 6;

	private static final double[] LATS = { -80, -40, 0, 40, 80 };
	private static final double[] LONS = { -180, -120, -60, 0, 60, 120 };
	private static final double[] ALTS = { 10, 20, 30 };

	/** L'identifiant d'un jeu MEAN est son nom de fichier sans l'extension. */
	private static final String FICHIER = "MY35_Ls000_030_mini.nc";
	private static final String DATASET = "MY35_Ls000_030_mini";
	/** Un second jeu, pour l'export de difference qui en exige deux distincts. */
	private static final String FICHIER_B = "MY35_Ls030_060_mini.nc";
	private static final String DATASET_B = "MY35_Ls030_060_mini";

	@Autowired
	private WebApplicationContext contexte;

	private MockMvc mvc;

	private MockMvc mvc() {
		if (mvc == null) {
			mvc = MockMvcBuilders.webAppContextSetup(contexte).build();
		}
		return mvc;
	}

	private static float attendu(int t, int a, int lat, int lon) {
		return 1000f * t + 100f * a + 10f * lat + lon;
	}

	@DynamicPropertySource
	static void donneesDeTest(DynamicPropertyRegistry registry) throws Exception {
		Path racine = Files.createTempDirectory("mcv-api-integration");
		racine.toFile().deleteOnExit();
		Path mean       = Files.createDirectories(racine.resolve("mean"));
		Path individual = Files.createDirectories(racine.resolve("individual"));
		ecrireMiniGemMars(mean.resolve(FICHIER));
		ecrireMiniGemMars(mean.resolve(FICHIER_B));
		registry.add("netcdf.mean.path", () -> mean.toString());
		registry.add("netcdf.individual.path", () -> individual.toString());
	}

	/** Une GEM-Mars miniature, structurellement fidele : 8 x 3 x 5 x 6. */
	private static void ecrireMiniGemMars(Path chemin) throws Exception {
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
							float v = attendu(t, a, la, lo);
							tt.set(t, a, la, lo, v);
							uu.set(t, a, la, lo, v);
							vv.set(t, a, la, lo, -v);
						}
					}
				}
			}
			w.write(w.findVariable("TT"), tt);
			w.write(w.findVariable("UU"), uu);
			w.write(w.findVariable("VV"), vv);

			// Surface : une onde diurne franche, pour que les marees aient
			// quelque chose a mesurer plutot qu'un champ plat.
			ArrayFloat.D3 mtsf = new ArrayFloat.D3(N_TIME, N_LAT, N_LON);
			for (int t = 0; t < N_TIME; t++) {
				for (int la = 0; la < N_LAT; la++) {
					for (int lo = 0; lo < N_LON; lo++) {
						mtsf.set(t, la, lo,
								(float) (210.0 + 30.0 * Math.sin(2 * Math.PI * t / N_TIME)));
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
	@DisplayName("catalogue")
	class Catalogue {

		@Test
		@DisplayName("le jeu synthétique est bien catalogué, avec son année et sa plage Ls")
		void catalogueLeJeu() throws Exception {
			// L'identifiant, l'annee et la plage Ls sont deduits du NOM du
			// fichier : c'est ce qui rend le catalogue dependant du nommage
			// fige par la pipeline.
			mvc().perform(get("/api/catalog"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$[0].id").value(DATASET))
					.andExpect(jsonPath("$[0].marsYear").value(35))
					.andExpect(jsonPath("$[0].lsStart").value(0))
					.andExpect(jsonPath("$[0].lsEnd").value(30))
					.andExpect(jsonPath("$.length()").value(2))
					.andExpect(jsonPath("$[1].id").value(DATASET_B));
		}
	}

	@Nested
	@DisplayName("GET /api/data/slice")
	class Slice {

		@Test
		@DisplayName("rend la grille à l’instant et l’altitude demandés")
		void grilleAttendue() throws Exception {
			mvc().perform(get("/api/data/slice")
							.param("dataset", DATASET)
							.param("variable", "TT")
							.param("time", "2")
							.param("altitude", "1"))
					.andExpect(status().isOk())
					.andExpect(header().string("Cache-Control",
							org.hamcrest.Matchers.containsString("max-age=2592000")))
					.andExpect(jsonPath("$.dataset").value(DATASET))
					.andExpect(jsonPath("$.altitudeValue").value(20.0))
					.andExpect(jsonPath("$.dimensions.lat").value(N_LAT))
					.andExpect(jsonPath("$.dimensions.lon").value(N_LON))
					.andExpect(jsonPath("$.latitudes[0]").value(-80.0))
					.andExpect(jsonPath("$.longitudes[5]").value(120.0))
					.andExpect(jsonPath("$.data[0][0]").value((double) attendu(2, 1, 0, 0)))
					.andExpect(jsonPath("$.data[4][5]").value((double) attendu(2, 1, 4, 5)))
					.andExpect(jsonPath("$.stats.min").exists())
					.andExpect(jsonPath("$.stats.max").exists());
		}

		@Test
		@DisplayName("un dataset inconnu rend 404, pas 500")
		void datasetInconnu() throws Exception {
			mvc().perform(get("/api/data/slice").param("dataset", "n_existe_pas"))
					.andExpect(status().isNotFound());
		}

		@Test
		@DisplayName("une variable absente du fichier rend 400")
		void variableInconnue() throws Exception {
			mvc().perform(get("/api/data/slice")
							.param("dataset", DATASET)
							.param("variable", "INEXISTANT"))
					.andExpect(status().isBadRequest());
		}

		@Test
		@DisplayName("le paramètre dataset est obligatoire")
		void datasetObligatoire() throws Exception {
			mvc().perform(get("/api/data/slice")).andExpect(status().isBadRequest());
		}
	}

	@Nested
	@DisplayName("GET /api/data/wind")
	class Vent {

		@Test
		@DisplayName("sous-échantillonne la grille et rend U et V appariés")
		void champSousEchantillonne() throws Exception {
			// Pas de 3 sur 5 latitudes et 6 longitudes : 2 x 2 vecteurs.
			mvc().perform(get("/api/data/wind")
							.param("dataset", DATASET)
							.param("time", "1")
							.param("altitude", "2"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.lats.length()").value(4))
					.andExpect(jsonPath("$.lons.length()").value(4))
					.andExpect(jsonPath("$.lats[0]").value(-80.0))
					.andExpect(jsonPath("$.lons[1]").value(0.0))
					.andExpect(jsonPath("$.u[0]").value((double) attendu(1, 2, 0, 0)))
					.andExpect(jsonPath("$.v[0]").value((double) -attendu(1, 2, 0, 0)));
		}

		@Test
		@DisplayName("l’altitude par défaut vaut 49, donc hors bornes ici : 400 et non 500")
		void altitudeParDefautHorsBornes() throws Exception {
			// Ce defaut de 49 est celui qui, envoye sous un mauvais nom de
			// parametre, faisait afficher le niveau 49 quoi qu'on choisisse.
			// Sur une grille a 3 niveaux il doit produire une erreur CLIENT.
			mvc().perform(get("/api/data/wind").param("dataset", DATASET))
					.andExpect(status().isBadRequest());
		}
	}

	@Nested
	@DisplayName("GET /api/data/timeseries")
	class SerieTemporelle {

		@Test
		@DisplayName("rend une valeur par pas de temps, au nœud de grille le plus proche")
		void serieAuPointDemande() throws Exception {
			// (-38 ; 5) tombe entre les noeuds : latitude -40 (indice 1),
			// longitude 0 (indice 3).
			mvc().perform(get("/api/data/timeseries")
							.param("dataset", DATASET)
							.param("variable", "TT")
							.param("latitude", "-38")
							.param("longitude", "5")
							.param("altitude", "1"))
					.andExpect(status().isOk())
					// La demande est renvoyee telle quelle...
					.andExpect(jsonPath("$.latitude").value(-38.0))
					.andExpect(jsonPath("$.longitude").value(5.0))
					// ...et le noeud REELLEMENT lu l'accompagne. C'est ce dernier
					// qui doit titrer le graphique : la mesure vient de la, pas
					// du point demande, et l'ecart atteint 2 degres sur cette grille.
					.andExpect(jsonPath("$.actualLat").value(-40.0))
					.andExpect(jsonPath("$.actualLon").value(0.0))
					.andExpect(jsonPath("$.values.length()").value(N_TIME))
					.andExpect(jsonPath("$.values[0]").value((double) attendu(0, 1, 1, 3)))
					.andExpect(jsonPath("$.values[7]").value((double) attendu(7, 1, 1, 3)));
		}
	}

	@Nested
	@DisplayName("GET /api/data/crosssection")
	class CoupeVerticale {

		@Test
		@DisplayName("coupe zonale : altitude par longitude, à la latitude ramenée sur la grille")
		void coupeZonale() throws Exception {
			mvc().perform(get("/api/data/crosssection")
							.param("dataset", DATASET)
							.param("variable", "TT")
							.param("time", "2")
							.param("type", "zonal")
							.param("fixedCoordinate", "35"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.fixedCoordinate").value(40.0))
					.andExpect(jsonPath("$.data.length()").value(N_ALT))
					.andExpect(jsonPath("$.data[0].length()").value(N_LON))
					.andExpect(jsonPath("$.horizontalCoords[0]").value(-180.0))
					.andExpect(jsonPath("$.data[1][2]").value((double) attendu(2, 1, 3, 2)));
		}

		@Test
		@DisplayName("coupe méridionale : altitude par latitude")
		void coupeMeridionale() throws Exception {
			mvc().perform(get("/api/data/crosssection")
							.param("dataset", DATASET)
							.param("variable", "TT")
							.param("time", "0")
							.param("type", "meridional")
							.param("fixedCoordinate", "55"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.fixedCoordinate").value(60.0))
					.andExpect(jsonPath("$.data[0].length()").value(N_LAT))
					.andExpect(jsonPath("$.data[2][4]").value((double) attendu(0, 2, 4, 4)));
		}

		@Test
		@DisplayName("un type de coupe inconnu rend 400")
		void typeInconnu() throws Exception {
			mvc().perform(get("/api/data/crosssection")
							.param("dataset", DATASET)
							.param("type", "diagonale")
							.param("fixedCoordinate", "0"))
					.andExpect(status().isBadRequest());
		}

		@Test
		@DisplayName("une variable de surface n’a pas de coupe verticale : 400")
		void variableDeSurface() throws Exception {
			mvc().perform(get("/api/data/crosssection")
							.param("dataset", DATASET)
							.param("variable", "MTSF")
							.param("type", "zonal")
							.param("fixedCoordinate", "0"))
					.andExpect(status().isBadRequest());
		}
	}

	@Nested
	@DisplayName("GET /api/data/animation")
	class Animation {

		@Test
		@DisplayName("rend une image par pas de temps")
		void unePlancheParInstant() throws Exception {
			mvc().perform(get("/api/data/animation")
							.param("dataset", DATASET)
							.param("variable", "TT")
							.param("altitude", "0"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.frameCount").value(N_TIME))
					.andExpect(jsonPath("$.frames.length()").value(N_TIME))
					.andExpect(jsonPath("$.frames[0].length()").value(N_LAT))
					.andExpect(jsonPath("$.frames[0][0].length()").value(N_LON))
					.andExpect(jsonPath("$.frames[3][2][1]").value((double) attendu(3, 0, 2, 1)));
		}
	}

	@Nested
	@DisplayName("GET /api/data/tides")
	class Marees {

		@Test
		@DisplayName("extrait l’onde diurne d’un champ de surface qui en porte une")
		void ondeDiurne() throws Exception {
			// MTSF oscille de +/- 30 K sur un cycle complet : l'amplitude
			// diurne doit valoir 30, la semi-diurne etre negligeable, et la
			// moyenne retomber sur 210.
			mvc().perform(get("/api/data/tides")
							.param("dataset", DATASET)
							.param("variable", "MTSF")
							.param("altitude", "0"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.amplitudeDiurnal.length()").value(N_LAT))
					.andExpect(jsonPath("$.amplitudeDiurnal[0].length()").value(N_LON))
					.andExpect(jsonPath("$.mean[0][0]").value(
							org.hamcrest.Matchers.closeTo(210.0, 0.01)))
					.andExpect(jsonPath("$.amplitudeDiurnal[0][0]").value(
							org.hamcrest.Matchers.closeTo(30.0, 0.01)))
					.andExpect(jsonPath("$.amplitudeSemidiurnal[0][0]").value(
							org.hamcrest.Matchers.closeTo(0.0, 0.01)))
					.andExpect(jsonPath("$.phaseDiurnal[0][0]").exists());
		}

		@Test
		@DisplayName("la phase reste dans [0, 24[ et ne vaut jamais 24")
		void phaseRepliee() throws Exception {
			// Le defaut corrige : pour un maximum a minuit, la phase sortait a
			// 24,0 apres l'arrondi en float, et deux cellules decrivant le meme
			// instant affichaient 24 h et 0 h de part et d'autre d'une couture.
			String corps = mvc().perform(get("/api/data/tides")
							.param("dataset", DATASET)
							.param("variable", "MTSF"))
					.andExpect(status().isOk())
					.andReturn().getResponse().getContentAsString();

			var json = new tools.jackson.databind.ObjectMapper().readTree(corps);
			for (var ligne : json.get("phaseDiurnal")) {
				for (var cellule : ligne) {
					double p = cellule.asDouble();
					org.assertj.core.api.Assertions.assertThat(p)
							.as("phase diurne dans [0, 24[")
							.isGreaterThanOrEqualTo(0.0)
							.isLessThan(24.0);
				}
			}
			for (var ligne : json.get("phaseSemidiurnal")) {
				for (var cellule : ligne) {
					org.assertj.core.api.Assertions.assertThat(cellule.asDouble())
							.as("phase semi-diurne dans [0, 12[")
							.isGreaterThanOrEqualTo(0.0)
							.isLessThan(12.0);
				}
			}
		}
	}

	// =========================================================================
	// Exports
	// =========================================================================

	@Nested
	@DisplayName("GET /api/export")
	class Exports {

		/** Chaque export : 200, disposition de piece jointe, jeu de caracteres, nom ASCII. */
		private void verifieExport(String chemin, String nomAttendu,
				org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder requete)
				throws Exception {
			var reponse = mvc().perform(requete)
					.andExpect(status().isOk())
					.andReturn().getResponse();

			String disposition = reponse.getHeader("Content-Disposition");
			org.assertj.core.api.Assertions.assertThat(disposition)
					.as("%s : une piece jointe, pas un form-data", chemin)
					.startsWith("attachment")
					.contains(nomAttendu);
			org.assertj.core.api.Assertions.assertThat(disposition.chars().allMatch(c -> c < 128))
					.as("%s : nom de fichier ASCII (%s)", chemin, disposition)
					.isTrue();
			org.assertj.core.api.Assertions.assertThat(reponse.getHeader("Content-Type"))
					.as("%s : le jeu de caracteres fait partie du contrat", chemin)
					.contains("charset=UTF-8");
			org.assertj.core.api.Assertions.assertThat(reponse.getContentAsString())
					.as("%s : le corps ne doit pas etre vide", chemin)
					.isNotBlank();
		}

		@Test
		@DisplayName("les neuf exports CSV répondent un fichier nommé et non vide")
		void tousLesCsv() throws Exception {
			verifieExport("/csv/slice", "slice_" + DATASET + "_TT_t0_alt0.csv",
					get("/api/export/csv/slice").param("dataset", DATASET));

			verifieExport("/csv/timeseries", "timeseries_",
					get("/api/export/csv/timeseries").param("dataset", DATASET)
							.param("latitude", "0").param("longitude", "0"));

			verifieExport("/csv/profile", "profile_",
					get("/api/export/csv/profile").param("dataset", DATASET)
							.param("latitude", "0").param("longitude", "0"));

			verifieExport("/csv/crosssection", "crosssection_",
					get("/api/export/csv/crosssection").param("dataset", DATASET)
							.param("type", "zonal").param("fixedCoordinate", "0"));

			verifieExport("/csv/hovmoller", "hovmoller_",
					get("/api/export/csv/hovmoller").param("dataset", DATASET));

			verifieExport("/csv/zonalmean", "zonalmean_",
					get("/api/export/csv/zonalmean").param("dataset", DATASET));

			// Le defaut d'altitude de la rose des vents vaut 49 : hors bornes ici,
			// il faut donc le donner explicitement.
			verifieExport("/csv/windrose", "windrose_",
					get("/api/export/csv/windrose").param("dataset", DATASET)
							.param("latitude", "0").param("longitude", "0")
							.param("altitude", "0"));

			verifieExport("/csv/difference", "difference_",
					get("/api/export/csv/difference")
							.param("datasetA", DATASET).param("datasetB", DATASET_B));

			verifieExport("/csv/temporal-profile", "temporal_profile_",
					get("/api/export/csv/temporal-profile").param("dataset", DATASET)
							.param("latitude", "0").param("longitude", "0"));
		}

		@Test
		@DisplayName("l’export NetCDF rend un fichier que la bibliothèque relit, avec ses attributs CF")
		void exportNetcdf() throws Exception {
			// Le seul controle qui vaut : reouvrir le fichier produit. Il se
			// declare Conventions = CF-1.8, donc units et long_name doivent
			// venir du fichier source et non d'un litteral.
			byte[] octets = mvc().perform(get("/api/export/netcdf/slice")
							.param("dataset", DATASET)
							.param("variable", "TT")
							.param("time", "1")
							.param("altitude", "2"))
					.andExpect(status().isOk())
					.andExpect(header().string("Content-Disposition",
							org.hamcrest.Matchers.startsWith("attachment")))
					.andReturn().getResponse().getContentAsByteArray();

			Path temporaire = Files.createTempFile("mcv-export-", ".nc");
			try {
				Files.write(temporaire, octets);
				try (ucar.nc2.NetcdfFile nc = ucar.nc2.NetcdfFiles.open(temporaire.toString())) {
					ucar.nc2.Variable tt = nc.findVariable("TT");
					org.assertj.core.api.Assertions.assertThat((Object) tt)
							.as("la variable exportee doit exister")
							.isNotNull();
					org.assertj.core.api.Assertions.assertThat(tt.findAttributeString("units", null))
							.isEqualTo("K");
					org.assertj.core.api.Assertions.assertThat(
							tt.findAttributeString("standard_name", null))
							.isEqualTo("air_temperature");
					org.assertj.core.api.Assertions.assertThat(
							nc.getRootGroup().findAttributeString("Conventions", null))
							.contains("CF-1.8");
					// Cast en Object : ucar.nc2.Variable rend assertThat ambigu.
					org.assertj.core.api.Assertions.assertThat((Object) nc.findVariable("lat")).isNotNull();
					org.assertj.core.api.Assertions.assertThat((Object) nc.findVariable("lon")).isNotNull();
				}
			} finally {
				Files.deleteIfExists(temporaire);
			}
		}

		@Test
		@DisplayName("une différence entre deux jeux identiques est refusée")
		void differenceEntreJeuxIdentiques() throws Exception {
			mvc().perform(get("/api/export/csv/difference")
							.param("datasetA", DATASET).param("datasetB", DATASET))
					.andExpect(status().isBadRequest());
		}
	}

	/**
	 * {@code /api/data/altitudes} : le point d'API qui dit a l'interface quels
	 * niveaux verticaux proposer, et s'il faut proposer un selecteur du tout.
	 *
	 * <p>Il n'etait exerce par rien : {@code CatalogController} affichait 0 % de
	 * branches. Or c'est lui qui distingue une variable tridimensionnelle d'une
	 * variable de SURFACE, et cette distinction commande l'affichage. Se
	 * tromper de branche donne soit un selecteur d'altitude sur une variable qui
	 * n'en a pas, soit un selecteur absent la ou il faudrait choisir.
	 *
	 * <p>Le jeu synthetique porte les deux cas : TT est en
	 * {@code time x altitudeT x lat x lon}, MTSF en {@code time x lat x lon}.
	 */
	@Nested
	@DisplayName("Niveaux d'altitude")
	class Altitudes {

		@Test
		@DisplayName("Une variable 3D rend ses niveaux, dans l'ordre du fichier")
		void variableTridimensionnelle() throws Exception {
			mvc().perform(get("/api/data/altitudes")
					.param("dataset", DATASET)
					.param("variable", "TT"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.surface").value(false))
				.andExpect(jsonPath("$.altitudes.length()").value(N_ALT))
				.andExpect(jsonPath("$.altitudes[0]").value(ALTS[0]))
				.andExpect(jsonPath("$.altitudes[1]").value(ALTS[1]))
				.andExpect(jsonPath("$.altitudes[2]").value(ALTS[2]));
		}

		/**
		 * MTSF n'a pas de dimension verticale. Le drapeau doit le dire, et le
		 * tableau rester VIDE plutot que nul : un tableau nul obligerait chaque
		 * appelant a s'en premunir, et un oubli casserait l'affichage.
		 */
		@Test
		@DisplayName("Une variable de surface l'annonce et rend un tableau vide")
		void variableDeSurface() throws Exception {
			mvc().perform(get("/api/data/altitudes")
					.param("dataset", DATASET)
					.param("variable", "MTSF"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.surface").value(true))
				.andExpect(jsonPath("$.altitudes").isArray())
				.andExpect(jsonPath("$.altitudes.length()").value(0));
		}

		/**
		 * La variable par defaut est TT : une requete qui ne la precise pas doit
		 * repondre comme si elle l'avait fait, sans 400.
		 */
		@Test
		@DisplayName("Sans variable precisee, la valeur par defaut s'applique")
		void variableParDefaut() throws Exception {
			mvc().perform(get("/api/data/altitudes").param("dataset", DATASET))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.surface").value(false))
				.andExpect(jsonPath("$.altitudes.length()").value(N_ALT));
		}

		@Test
		@DisplayName("Un jeu inexistant rend 404, pas une liste vide")
		void jeuInexistant() throws Exception {
			mvc().perform(get("/api/data/altitudes")
					.param("dataset", "jeu_qui_n_existe_pas")
					.param("variable", "TT"))
				.andExpect(status().isNotFound());
		}

		/**
		 * La liste des niveaux ne change pas d'une requete a l'autre pour un
		 * fichier donne : elle merite l'en-tete de cache des metadonnees, sinon
		 * chaque changement de variable la retelecharge.
		 */
		@Test
		@DisplayName("La reponse porte l'en-tete de cache des donnees")
		void enTeteDeCache() throws Exception {
			mvc().perform(get("/api/data/altitudes")
					.param("dataset", DATASET)
					.param("variable", "TT"))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control",
						org.hamcrest.Matchers.containsString("max-age")));
		}

		/**
		 * Le parametre manquant est le seul obligatoire : son absence doit
		 * produire un refus lisible, pas une resolution sur un nom vide.
		 */
		@Test
		@DisplayName("Le jeu de donnees est obligatoire")
		void datasetObligatoire() throws Exception {
			mvc().perform(get("/api/data/altitudes").param("variable", "TT"))
				.andExpect(status().isBadRequest());
		}
	}
}
