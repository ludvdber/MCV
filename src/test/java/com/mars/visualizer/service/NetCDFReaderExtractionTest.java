package com.mars.visualizer.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.dto.internal.AnimationData;
import com.mars.visualizer.dto.internal.CrossSectionData;
import com.mars.visualizer.dto.internal.HovmollerData;
import com.mars.visualizer.dto.internal.SliceData;
import com.mars.visualizer.dto.internal.TemporalProfileData;
import com.mars.visualizer.dto.internal.TransectData;
import com.mars.visualizer.dto.internal.VariableMetadata;
import com.mars.visualizer.dto.internal.WindFieldData;
import com.mars.visualizer.dto.internal.WindRoseData;
import com.mars.visualizer.dto.internal.ZonalMeanData;
import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.util.MarsConstants;

import ucar.ma2.ArrayDouble;
import ucar.ma2.ArrayFloat;
import ucar.ma2.DataType;
import ucar.nc2.Attribute;
import ucar.nc2.write.NetcdfFormatWriter;

/**
 * Les dix methodes d'extraction que {@code NetCDFReaderServiceTest} ne touchait
 * pas : coupe verticale, Hovmoller, champ de vent, rose des vents, moyenne
 * zonale, animation, profil temporel, transect, altitudes. Plus
 * {@code readVariableMetadata} et la correction du biais MTSF.
 *
 * <p>Elles servent dix des dix-sept points d'API et n'etaient verifiees que par
 * un appel au serveur vivant, avec les vraies donnees : sur un clone frais,
 * {@code ./gradlew test} n'en prouvait rien. La couverture mesuree de
 * {@code NetCDFReaderService} etait de 25 % d'instructions et 24 % de branches.
 *
 * <p>La grille de test est une <b>GEM-Mars miniature</b> : 4 pas de temps,
 * 3 altitudes, 5 latitudes, 6 longitudes. Chaque valeur encode ses propres
 * indices ({@code 1000*t + 100*alt + 10*lat + lon}), donc une valeur lue dit
 * d'ou elle vient et toute erreur d'indexation se lit dans le message d'echec.
 * L'axe des longitudes <b>fait le tour</b> (pas de 60 degres, couture de 60
 * entre 120 et -180), celui des latitudes non : c'est la meme asymetrie que
 * cote frontend.
 */
class NetCDFReaderExtractionTest {

	@TempDir
	static Path tempDir;

	static NetCDFReaderService service;

	/** Fichier complet : TT, H2O, UU, VV, PP, MTSF. */
	static final String FICHIER = "mini_gemmars.nc";
	/** Meme grille, mais sans UU ni VV : le cas « pas de vent dans ce jeu ». */
	static final String SANS_VENT = "sans_vent.nc";

	static final int N_TIME = 4;
	static final int N_ALT  = 3;
	static final int N_LAT  = 5;
	static final int N_LON  = 6;

	static final double[] LATS = { -80, -40, 0, 40, 80 };
	/** Pas de 60 degres : l'ecart entre 120 et -180 vaut aussi 60, l'axe boucle. */
	static final double[] LONS = { -180, -120, -60, 0, 60, 120 };
	static final double[] ALTS = { 10, 20, 30 };

	/**
	 * Colonnes de MTSF, choisies autour du seuil de 350 K :
	 * biaisee, froide legitime, juste sous le seuil, biaisee, masquee, chaude legitime.
	 */
	static final float[] MTSF_BASE = { 500f, 220f, 349f, 400f, Float.NaN, 300f };

	/** La valeur analytique d'une cellule 4D. */
	static float attendu(int t, int a, int lat, int lon) {
		return 1000f * t + 100f * a + 10f * lat + lon;
	}

	@BeforeAll
	static void ecrireLesFichiers() throws Exception {
		ecrireFichier(tempDir.resolve(FICHIER).toString(), true);
		ecrireFichier(tempDir.resolve(SANS_VENT).toString(), false);

		DataPathConfig config = mock(DataPathConfig.class);
		when(config.getMeanPath()).thenReturn(tempDir);
		when(config.getIndividualPath()).thenReturn(tempDir);
		service = new NetCDFReaderService(config);
	}

	static void ecrireFichier(String chemin, boolean avecVent) throws Exception {
		NetcdfFormatWriter.Builder b = NetcdfFormatWriter.createNewNetcdf3(chemin);

		b.addDimension("time", N_TIME);
		b.addDimension("altitudeT", N_ALT);
		b.addDimension("lat", N_LAT);
		b.addDimension("lon", N_LON);

		// TT porte les trois attributs CF, comme les vrais fichiers GEM-Mars.
		b.addVariable("TT", DataType.FLOAT, "time altitudeT lat lon")
			.addAttribute(new Attribute("units", "K"))
			.addAttribute(new Attribute("standard_name", "air_temperature"))
			.addAttribute(new Attribute("long_name", "Air temperature"));

		// H2O n'a PAS de standard_name : le cas ou il ne faut rien inventer.
		b.addVariable("H2O", DataType.FLOAT, "time altitudeT lat lon")
			.addAttribute(new Attribute("units", "kg/kg"))
			.addAttribute(new Attribute("long_name", "Water vapour mass mixing ratio"));

		// PP varie en carre de l'indice de latitude : sans cela, une moyenne
		// ponderee par cos(lat) et une moyenne uniforme donnent le meme nombre
		// sur cette grille symetrique, et le test ne prouverait rien.
		b.addVariable("PP", DataType.FLOAT, "time altitudeT lat lon")
			.addAttribute(new Attribute("units", "Pa"));

		if (avecVent) {
			b.addVariable("UU", DataType.FLOAT, "time altitudeT lat lon")
				.addAttribute(new Attribute("units", "m s-1"));
			// VV ne porte AUCUN attribut : le repli sur « unknown ».
			b.addVariable("VV", DataType.FLOAT, "time altitudeT lat lon");
		}

		// Variable de SURFACE (3D) : le chemin isSurface et le biais MTSF.
		b.addVariable("MTSF", DataType.FLOAT, "time lat lon")
			.addAttribute(new Attribute("units", "K"));

		b.addVariable("lat", DataType.DOUBLE, "lat");
		b.addVariable("lon", DataType.DOUBLE, "lon");
		b.addVariable("altitudeT", DataType.DOUBLE, "altitudeT");

		try (NetcdfFormatWriter w = b.build()) {
			ArrayFloat.D4 tt  = new ArrayFloat.D4(N_TIME, N_ALT, N_LAT, N_LON);
			ArrayFloat.D4 h2o = new ArrayFloat.D4(N_TIME, N_ALT, N_LAT, N_LON);
			ArrayFloat.D4 pp  = new ArrayFloat.D4(N_TIME, N_ALT, N_LAT, N_LON);
			ArrayFloat.D4 uu  = new ArrayFloat.D4(N_TIME, N_ALT, N_LAT, N_LON);
			ArrayFloat.D4 vv  = new ArrayFloat.D4(N_TIME, N_ALT, N_LAT, N_LON);

			for (int t = 0; t < N_TIME; t++) {
				for (int a = 0; a < N_ALT; a++) {
					for (int la = 0; la < N_LAT; la++) {
						for (int lo = 0; lo < N_LON; lo++) {
							float v = attendu(t, a, la, lo);
							tt.set(t, a, la, lo, v);
							uu.set(t, a, la, lo, v);
							vv.set(t, a, la, lo, -v);
							pp.set(t, a, la, lo, 1000f * t + 100f * a + 10f * la * la + lo);
							// Derniere latitude entierement masquee (moyenne
							// impossible), plus un trou isole en (lat 0, lon 0).
							boolean masque = (la == N_LAT - 1) || (la == 0 && lo == 0);
							h2o.set(t, a, la, lo, masque ? Float.NaN : v);
						}
					}
				}
			}
			w.write(w.findVariable("TT"), tt);
			w.write(w.findVariable("H2O"), h2o);
			w.write(w.findVariable("PP"), pp);
			if (avecVent) {
				w.write(w.findVariable("UU"), uu);
				w.write(w.findVariable("VV"), vv);
			}

			// MTSF : base par colonne + t (fait bouger l'axe du temps) +
			// lat/1000 (fait bouger l'axe des latitudes sans franchir le seuil).
			// A t=1, lon=2, lat=0 la valeur vaut EXACTEMENT 350,0 : la cellule
			// voisine (lat=1) vaut 350,001. Les deux encadrent l'inegalite
			// stricte du seuil.
			ArrayFloat.D3 mtsf = new ArrayFloat.D3(N_TIME, N_LAT, N_LON);
			for (int t = 0; t < N_TIME; t++) {
				for (int la = 0; la < N_LAT; la++) {
					for (int lo = 0; lo < N_LON; lo++) {
						mtsf.set(t, la, lo, (float) (MTSF_BASE[lo] + t + la * 0.001));
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
	// Metadonnees CF — l'export NetCDF se declare CF-1.8 et doit le tenir
	// =========================================================================

	@Nested
	@DisplayName("readVariableMetadata")
	class Metadonnees {

		@Test
		@DisplayName("recopie units, standard_name et long_name du fichier source")
		void recopieLesTroisAttributs() {
			VariableMetadata m = service.readVariableMetadata(FICHIER, "TT");
			assertEquals("K", m.units());
			assertEquals("air_temperature", m.standardName());
			assertEquals("Air temperature", m.longName());
		}

		@Test
		@DisplayName("laisse standard_name à null plutôt que de l'inventer")
		void nInventePasDeStandardName() {
			// standard_name est une liste normative : une valeur devinee est
			// pire qu'une absence, un outil CF la refuserait.
			VariableMetadata m = service.readVariableMetadata(FICHIER, "H2O");
			assertEquals("kg/kg", m.units());
			assertNull(m.standardName());
			assertEquals("Water vapour mass mixing ratio", m.longName());
		}

		@Test
		@DisplayName("replie une unité absente sur « unknown » plutôt que sur null")
		void replieUniteAbsente() {
			// VV ne porte aucun attribut. Un units null dans un fichier CF est
			// invalide ; le record garantit une chaine non vide.
			VariableMetadata m = service.readVariableMetadata(FICHIER, "VV");
			assertEquals(VariableMetadata.UNITE_INCONNUE, m.units());
			assertNull(m.standardName());
			assertNull(m.longName());
		}

		@Test
		@DisplayName("rejette une variable absente du fichier")
		void rejetteVariableAbsente() {
			assertThrows(ValidationException.class,
					() -> service.readVariableMetadata(FICHIER, "INEXISTANT"));
		}
	}

	// =========================================================================
	// Biais MTSF — correction temporaire d'un defaut de la pipeline amont
	// =========================================================================

	@Nested
	@DisplayName("correction du biais MTSF")
	class BiaisMtsf {

		@Test
		@DisplayName("retire 273,15 K aux seules valeurs physiquement impossibles")
		void corrigeLesSeulesValeursImpossibles() {
			// t=0 : les valeurs valent exactement MTSF_BASE + lat/1000.
			SliceData s = service.extractSlice2DWithCoords(FICHIER, "MTSF", 0, 0);

			assertEquals(500f - 273.15f, s.data()[0][0], 1e-3f, "500 K est impossible sur Mars");
			assertEquals(220f,           s.data()[0][1], 1e-3f, "220 K est une vraie temperature");
			assertEquals(349f,           s.data()[0][2], 1e-3f, "349 K reste sous le seuil");
			assertEquals(400f - 273.15f, s.data()[0][3], 1e-3f, "400 K est impossible");
			assertTrue(Float.isNaN(s.data()[0][4]), "une cellule masquee reste masquee");
			assertEquals(300f,           s.data()[0][5], 1e-3f, "300 K est plausible");
		}

		@Test
		@DisplayName("le seuil est une inégalité stricte : 350,0 K passe, 350,001 K non")
		void seuilStrict() {
			// t=1, colonne 2 : lat 0 vaut 350,0 pile et lat 1 vaut 350,001.
			// Deux cellules voisines de part et d'autre du « > ».
			SliceData s = service.extractSlice2DWithCoords(FICHIER, "MTSF", 1, 0);

			assertEquals(350f, s.data()[0][2], 1e-4f,
					"350,0 n'est pas STRICTEMENT superieur a 350 : pas de correction");
			assertEquals(350.001f - 273.15f, s.data()[1][2], 1e-2f,
					"350,001 franchit le seuil : correction appliquee");
		}

		@Test
		@DisplayName("ne touche jamais une variable qui n'est pas MTSF")
		void neToucheQueMtsf() {
			// TT monte a 3245 dans cette grille, bien au-dessus du seuil, et
			// doit rester intacte : la correction est nommee, pas numerique.
			SliceData s = service.extractSlice2DWithCoords(FICHIER, "TT", 3, 2);
			assertEquals(attendu(3, 2, 0, 0), s.data()[0][0], 1e-3f);
			assertEquals(attendu(3, 2, 4, 5), s.data()[4][5], 1e-3f);
		}
	}

	// =========================================================================
	// Animation diurne
	// =========================================================================

	@Nested
	@DisplayName("extractAnimationFrames")
	class Animation {

		@Test
		@DisplayName("rend une image par pas de temps, à l'altitude demandée")
		void rendUneImageParPasDeTemps() {
			AnimationData a = service.extractAnimationFrames(FICHIER, "TT", 2);

			assertEquals(N_TIME, a.frames().size());
			assertEquals(N_LAT, a.frames().get(0).length);
			assertEquals(N_LON, a.frames().get(0)[0].length);
			assertArrayEquals(LATS, a.latitudes(), 1e-9);
			assertArrayEquals(LONS, a.longitudes(), 1e-9);

			for (int t = 0; t < N_TIME; t++) {
				for (int la = 0; la < N_LAT; la++) {
					for (int lo = 0; lo < N_LON; lo++) {
						assertEquals(attendu(t, 2, la, lo), a.frames().get(t)[la][lo], 1e-3f,
								"image " + t + " cellule [" + la + "][" + lo + "]");
					}
				}
			}
		}

		@Test
		@DisplayName("accepte une variable de surface et y applique la correction MTSF")
		void variableDeSurface() {
			// Pas d'axe d'altitude : l'index passe doit etre ignore, pas
			// propage dans la lecture.
			AnimationData a = service.extractAnimationFrames(FICHIER, "MTSF", 0);

			assertEquals(N_TIME, a.frames().size());
			assertEquals(N_LAT, a.frames().get(0).length);
			assertEquals(N_LON, a.frames().get(0)[0].length);
			// colonne 0 : 500 + t, toujours impossible, toujours corrigee
			for (int t = 0; t < N_TIME; t++) {
				assertEquals(500f + t - 273.15f, a.frames().get(t)[0][0], 1e-2f);
			}
		}
	}

	// =========================================================================
	// Coupe verticale
	// =========================================================================

	@Nested
	@DisplayName("extractCrossSection")
	class CoupeVerticale {

		@Test
		@DisplayName("méridionale : altitude × latitude à une longitude figée")
		void meridionale() {
			// 55 degres : la longitude de grille la plus proche est 60 (index 4).
			CrossSectionData c = service.extractCrossSection(
					FICHIER, "TT", 2, MarsConstants.CROSS_SECTION_MERIDIONAL, 55.0);

			assertEquals(60.0, c.fixedValue(), 1e-9, "la longitude est ramenee sur la grille");
			assertEquals(N_ALT, c.data().length);
			assertEquals(N_LAT, c.data()[0].length);
			assertArrayEquals(ALTS, c.altitudes(), 1e-9);
			assertArrayEquals(LATS, c.horizontalCoords(), 1e-9);

			for (int a = 0; a < N_ALT; a++) {
				for (int la = 0; la < N_LAT; la++) {
					assertEquals(attendu(2, a, la, 4), c.data()[a][la], 1e-3f);
				}
			}
		}

		@Test
		@DisplayName("zonale : altitude × longitude à une latitude figée")
		void zonale() {
			// 35 degres : la latitude de grille la plus proche est 40 (index 3).
			CrossSectionData c = service.extractCrossSection(
					FICHIER, "TT", 2, MarsConstants.CROSS_SECTION_ZONAL, 35.0);

			assertEquals(40.0, c.fixedValue(), 1e-9);
			assertEquals(N_ALT, c.data().length);
			assertEquals(N_LON, c.data()[0].length);
			assertArrayEquals(LONS, c.horizontalCoords(), 1e-9);

			for (int a = 0; a < N_ALT; a++) {
				for (int lo = 0; lo < N_LON; lo++) {
					assertEquals(attendu(2, a, 3, lo), c.data()[a][lo], 1e-3f);
				}
			}
		}

		@Test
		@DisplayName("refuse un type inconnu et une variable de surface")
		void refuseTypeEtSurface() {
			assertThrows(ValidationException.class, () -> service.extractCrossSection(
					FICHIER, "TT", 0, "diagonale", 0.0));
			assertThrows(ValidationException.class, () -> service.extractCrossSection(
					FICHIER, "MTSF", 0, MarsConstants.CROSS_SECTION_ZONAL, 0.0));
		}
	}

	// =========================================================================
	// Moyenne zonale
	// =========================================================================

	@Nested
	@DisplayName("extractZonalMean")
	class MoyenneZonale {

		@Test
		@DisplayName("moyenne sur toutes les longitudes, à chaque altitude")
		void moyenneSurLesLongitudes() {
			ZonalMeanData z = service.extractZonalMean(FICHIER, "TT", 1);

			assertEquals(N_ALT, z.data().length);
			assertEquals(N_LAT, z.data()[0].length);
			assertArrayEquals(LATS, z.latitudes(), 1e-9);
			assertArrayEquals(ALTS, z.altitudes(), 1e-9);

			// moyenne de lon = 0..5 → 2,5
			for (int a = 0; a < N_ALT; a++) {
				for (int la = 0; la < N_LAT; la++) {
					assertEquals(1000f + 100f * a + 10f * la + 2.5f, z.data()[a][la], 1e-3f);
				}
			}
		}

		@Test
		@DisplayName("ignore les cellules masquées et rend NaN quand toute la rangée l'est")
		void gereLesCellulesMasquees() {
			ZonalMeanData z = service.extractZonalMean(FICHIER, "H2O", 1);

			// latitude 0 : lon 0 est masquee, moyenne de lon = 1..5 → 3
			assertEquals(1000f + 3f, z.data()[0][0], 1e-3f,
					"une cellule masquee ne doit pas compter comme un zero");
			// latitude 4 : entierement masquee, aucune moyenne possible
			for (int a = 0; a < N_ALT; a++) {
				assertTrue(Float.isNaN(z.data()[a][N_LAT - 1]),
						"une rangee entierement masquee vaut NaN, pas 0");
			}
		}

		@Test
		@DisplayName("refuse une variable de surface")
		void refuseSurface() {
			assertThrows(ValidationException.class,
					() -> service.extractZonalMean(FICHIER, "MTSF", 0));
		}
	}

	// =========================================================================
	// Hovmoller
	// =========================================================================

	@Nested
	@DisplayName("extractHovmoller")
	class Hovmoller {

		@Test
		@DisplayName("axe latitude : moyenne zonale à poids uniformes")
		void axeLatitude() {
			// On garde la latitude et on moyenne sur la longitude : a latitude
			// fixe, toutes les cellules couvrent la meme aire, poids uniformes.
			HovmollerData h = service.extractHovmoller(FICHIER, "TT", 1, "latitude");

			assertEquals(N_TIME, h.data().length);
			assertEquals(N_LAT, h.data()[0].length);
			assertArrayEquals(LATS, h.spatialCoords(), 1e-9);

			for (int t = 0; t < N_TIME; t++) {
				assertEquals(t * 0.5, h.times()[t], 1e-9, "axe des temps en demi-heures");
				for (int la = 0; la < N_LAT; la++) {
					assertEquals(1000f * t + 100f + 10f * la + 2.5f, h.data()[t][la], 1e-3f);
				}
			}
		}

		@Test
		@DisplayName("axe longitude : moyenne méridienne pondérée par cos(lat)")
		void axeLongitudePondere() {
			// On garde la longitude et on moyenne sur la latitude : les mailles
			// retrecissent vers les poles, une moyenne uniforme sur-representerait
			// les hautes latitudes.
			HovmollerData h = service.extractHovmoller(FICHIER, "PP", 0, "longitude");

			assertEquals(N_TIME, h.data().length);
			assertEquals(N_LON, h.data()[0].length);
			assertArrayEquals(LONS, h.spatialCoords(), 1e-9);

			// PP(0, 0, la, lo) = 10*la^2 + lo
			double sommePonderee = 0, sommePoids = 0, sommeUniforme = 0;
			for (int la = 0; la < N_LAT; la++) {
				double w = Math.max(0.0, Math.cos(Math.toRadians(LATS[la])));
				sommePonderee += w * (10.0 * la * la);
				sommePoids    += w;
				sommeUniforme += 10.0 * la * la;
			}
			double pondere  = sommePonderee / sommePoids;
			double uniforme = sommeUniforme / N_LAT;

			// Le test ne vaut que si les deux conventions different vraiment :
			// sur un champ lineaire en latitude et une grille symetrique, elles
			// donnent le meme nombre et n'importe quelle ponderation passerait.
			assertNotEquals(uniforme, pondere, 0.5,
					"la grille doit distinguer les deux moyennes, sinon le test ne prouve rien");

			for (int t = 0; t < N_TIME; t++) {
				for (int lo = 0; lo < N_LON; lo++) {
					assertEquals(1000.0 * t + lo + pondere, h.data()[t][lo], 1e-2,
							"t=" + t + " lon=" + lo);
				}
			}
		}

		@Test
		@DisplayName("variable de surface : moyenne les valeurs corrigées et saute les masquées")
		void variableDeSurface() {
			HovmollerData h = service.extractHovmoller(FICHIER, "MTSF", 0, "latitude");

			assertEquals(N_TIME, h.data().length);
			assertEquals(N_LAT, h.data()[0].length);

			// t=0, latitude 0 : pas de decalage lat/1000, les six colonnes sont
			// 500, 220, 349, 400, NaN, 300 → cinq valeurs, deux corrigees.
			double somme = (500f - 273.15f) + 220f + 349f + (400f - 273.15f) + 300f;
			assertEquals(somme / 5.0, h.data()[0][0], 1e-2,
					"la moyenne porte sur les valeurs CORRIGEES, la masquee etant sautee");
		}
	}

	// =========================================================================
	// Profil temporel
	// =========================================================================

	@Nested
	@DisplayName("extractTemporalProfile")
	class ProfilTemporel {

		@Test
		@DisplayName("rend altitude × temps en un point ramené sur la grille")
		void rendAltitudeParTemps() {
			// (-38, 5) tombe entre les noeuds : latitude -40 (index 1),
			// longitude 0 (index 3).
			TemporalProfileData p = service.extractTemporalProfile(FICHIER, "TT", -38.0, 5.0);

			assertEquals(-40.0, p.actualLat(), 1e-9);
			assertEquals(0.0, p.actualLon(), 1e-9);
			assertEquals(N_ALT, p.data().length);
			assertEquals(N_TIME, p.data()[0].length);
			assertArrayEquals(ALTS, p.altitudes(), 1e-9);

			for (int a = 0; a < N_ALT; a++) {
				for (int t = 0; t < N_TIME; t++) {
					assertEquals(attendu(t, a, 1, 3), p.data()[a][t], 1e-3f);
				}
			}
		}

		@Test
		@DisplayName("refuse une variable de surface")
		void refuseSurface() {
			assertThrows(ValidationException.class,
					() -> service.extractTemporalProfile(FICHIER, "MTSF", 0.0, 0.0));
		}
	}

	// =========================================================================
	// Transect grand-cercle
	// =========================================================================

	@Nested
	@DisplayName("extractTransect")
	class Transect {

		@Test
		@DisplayName("échantillonne la géodésique sur la grille native")
		void echantillonneLaGeodesique() {
			// Equateur, de -60 a 60 : les trois points tombent exactement sur
			// des noeuds (lon -60, 0, 60 → index 2, 3, 4 ; lat 0 → index 2).
			TransectData tr = service.extractTransect(FICHIER, "TT", 0, 0.0, -60.0, 0.0, 60.0, 3);

			assertEquals(N_ALT, tr.data().length);
			assertEquals(3, tr.data()[0].length);
			assertArrayEquals(ALTS, tr.altitudes(), 1e-9);

			assertEquals(0.0, tr.lats()[0], 1e-6);
			assertEquals(-60.0, tr.lons()[0], 1e-6, "le trajet part du point A");
			assertEquals(60.0, tr.lons()[2], 1e-6, "et arrive au point B");

			assertEquals(0.0, tr.distances()[0], 1e-6, "la distance part de zero");
			assertTrue(tr.distances()[1] > tr.distances()[0], "la distance croit");
			assertTrue(tr.distances()[2] > tr.distances()[1], "la distance croit");

			for (int a = 0; a < N_ALT; a++) {
				for (int p = 0; p < 3; p++) {
					assertEquals(attendu(0, a, 2, 2 + p), tr.data()[a][p], 1e-3f,
							"altitude " + a + " point " + p);
				}
			}
		}

		@Test
		@DisplayName("refuse une variable de surface")
		void refuseSurface() {
			assertThrows(ValidationException.class, () -> service.extractTransect(
					FICHIER, "MTSF", 0, 0.0, 0.0, 10.0, 10.0, 3));
		}
	}

	// =========================================================================
	// Vent
	// =========================================================================

	@Nested
	@DisplayName("extractWindField")
	class ChampDeVent {

		@Test
		@DisplayName("sous-échantillonne d'un pas de 3 en latitude comme en longitude")
		void sousEchantillonne() {
			// 5 latitudes → indices 0 et 3 ; 6 longitudes → indices 0 et 3.
			WindFieldData w = service.extractWindField(FICHIER, 1, 2);

			assertEquals(4, w.lats().length, "2 latitudes x 2 longitudes retenues");
			assertEquals(4, w.lons().length);
			assertEquals(4, w.u().length);
			assertEquals(4, w.v().length);

			int[][] attendus = { { 0, 0 }, { 0, 3 }, { 3, 0 }, { 3, 3 } };
			for (int k = 0; k < 4; k++) {
				int la = attendus[k][0], lo = attendus[k][1];
				assertEquals(LATS[la], w.lats()[k], 1e-9, "vecteur " + k);
				assertEquals(LONS[lo], w.lons()[k], 1e-9, "vecteur " + k);
				assertEquals(attendu(1, 2, la, lo), w.u()[k], 1e-3, "U du vecteur " + k);
				assertEquals(-attendu(1, 2, la, lo), w.v()[k], 1e-3, "V du vecteur " + k);
			}
		}

		@Test
		@DisplayName("rend un champ vide, et non une erreur, quand UU/VV manquent")
		void sansVent() {
			// Tous les jeux ne portent pas le vent : l'absence est un cas
			// normal, la carte doit s'afficher sans la couche.
			WindFieldData w = service.extractWindField(SANS_VENT, 0, 0);
			assertEquals(0, w.lats().length);
			assertEquals(0, w.lons().length);
			assertEquals(0, w.u().length);
			assertEquals(0, w.v().length);
		}
	}

	@Nested
	@DisplayName("extractWindRose")
	class RoseDesVents {

		@Test
		@DisplayName("rend UU et VV sur tout le cycle en un point de grille")
		void rendLeCycleComplet() {
			WindRoseData r = service.extractWindRose(FICHIER, -80.0, -180.0, 1);

			assertEquals(-80.0, r.actualLat(), 1e-9);
			assertEquals(-180.0, r.actualLon(), 1e-9);
			assertEquals(N_TIME, r.uu().size());
			assertEquals(N_TIME, r.vv().size());

			List<Float> uu = r.uu();
			List<Float> vv = r.vv();
			for (int t = 0; t < N_TIME; t++) {
				assertEquals(attendu(t, 1, 0, 0), uu.get(t), 1e-3f);
				assertEquals(-attendu(t, 1, 0, 0), vv.get(t), 1e-3f);
			}
		}

		@Test
		@DisplayName("échoue explicitement si le fichier ne porte pas le vent")
		void echoueSansVent() {
			// Contrairement au champ de vent, la rose N'A DE SENS que s'il y a
			// du vent : une rose vide serait un graphique mensonger.
			assertThrows(ValidationException.class,
					() -> service.extractWindRose(SANS_VENT, 0.0, 0.0, 0));
		}
	}

	// =========================================================================
	// Altitudes
	// =========================================================================

	@Nested
	@DisplayName("altitudes")
	class Altitudes {

		@Test
		@DisplayName("extractAltitudeArray rend les niveaux, ou null pour une variable de surface")
		void tableauDAltitudes() {
			assertArrayEquals(ALTS, service.extractAltitudeArray(FICHIER, "TT"), 1e-9);
			assertNull(service.extractAltitudeArray(FICHIER, "MTSF"),
					"une variable de surface n'a pas d'axe vertical");
		}

		@Test
		@DisplayName("extractAltitudeValue rend le niveau demandé, null hors bornes")
		void valeurDAltitude() {
			assertEquals(10.0, service.extractAltitudeValue(FICHIER, "TT", 0), 1e-9);
			assertEquals(30.0, service.extractAltitudeValue(FICHIER, "TT", 2), 1e-9);
			assertNull(service.extractAltitudeValue(FICHIER, "TT", 99),
					"un index hors bornes rend null, il ne fait pas planter la requete");
			assertNull(service.extractAltitudeValue(FICHIER, "MTSF", 0));
		}

		@Test
		@DisplayName("les deux rejettent une variable absente du fichier")
		void variableAbsente() {
			assertThrows(ValidationException.class,
					() -> service.extractAltitudeArray(FICHIER, "INEXISTANT"));
			assertThrows(ValidationException.class,
					() -> service.extractAltitudeValue(FICHIER, "INEXISTANT", 0));
		}
	}

	// =========================================================================
	// Couture des longitudes
	// =========================================================================

	@Nested
	@DisplayName("findNearestLonIndex")
	class CoutureDesLongitudes {

		@Test
		@DisplayName("175° est plus proche de -180° que de 120°")
		void franchitLaCouture() {
			// Distance circulaire : 5 degres d'un cote, 55 de l'autre.
			// Une recherche naive par |a - b| repondrait 120 (index 5).
			int i = service.findNearestLonIndex(LONS, 175.0);
			assertEquals(0, i, "l'axe des longitudes boucle");
			assertNotEquals(5, i, "une distance non circulaire se tromperait ici");
		}

		@Test
		@DisplayName("fonctionne aussi sur une grille exprimée de 0 à 360")
		void autreConvention() {
			// Les deux conventions circulent dans la nature ; -5 doit tomber
			// sur 355 et non sur 0.
			double[] zeroTrois60 = { 0, 60, 120, 180, 240, 300, 355 };
			assertEquals(6, service.findNearestLonIndex(zeroTrois60, -5.0));
			assertEquals(0, service.findNearestLonIndex(zeroTrois60, 359.0));
		}

		@Test
		@DisplayName("une cible négative sur une grille 0-360 ne produit pas de distance négative")
		void ecartSuperieurAUnTour() {
			// Ce cas est le seul qui distingue le modulo du simple repli
			// « si d > 180 alors 360 - d » : l'ecart brut entre 359 et -179
			// vaut 538, plus d'un tour. Sans le modulo, 360 - 538 = -178, une
			// distance NEGATIVE qui bat toutes les autres, et la fonction rend
			// 359 la ou la reponse est 180 : 179 degres d'erreur.
			double[] lons = { 0, 90, 180, 270, 359 };
			assertEquals(2, service.findNearestLonIndex(lons, -179.0),
					"-179 equivaut a 181, le noeud le plus proche est 180");
		}
	}
}
