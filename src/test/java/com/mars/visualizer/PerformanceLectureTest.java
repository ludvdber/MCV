package com.mars.visualizer;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.dto.internal.AnimationData;
import com.mars.visualizer.dto.internal.SliceData;

import ucar.ma2.ArrayDouble;
import ucar.ma2.ArrayFloat;
import ucar.ma2.DataType;
import ucar.nc2.Attribute;
import ucar.nc2.NetcdfFile;
import ucar.nc2.NetcdfFiles;
import ucar.nc2.Variable;
import ucar.nc2.write.NetcdfFormatWriter;

/**
 * La lecture est-elle vraiment partielle ?
 *
 * <p>C'est la promesse structurante du projet : les fichiers GEM-Mars pesent
 * plusieurs centaines de mega-octets et l'application en sert des tranches sans
 * jamais les charger entierement. Rien ne le verifiait. Un remaniement qui
 * remplacerait {@code variable.read(origin, shape)} par {@code variable.read()}
 * donnerait exactement les memes valeurs, passerait tous les tests existants, et
 * ferait s'effondrer le serveur des le premier visiteur.
 *
 * <p>Mesurer un TEMPS pour le prouver serait fragile — une machine chargee, un
 * disque lent, et le test clignote. La preuve utilisee ici est la
 * <b>memoire allouee</b> par le fil d'execution pendant l'appel
 * ({@code com.sun.management.ThreadMXBean}). C'est la grandeur que la lecture
 * partielle fait varier de trois ordres de grandeur, et elle ne depend ni de la
 * charge de la machine ni de la vitesse du disque : lire le cube entier oblige
 * a allouer ses 38 Mo, lire une tranche n'en alloue que 13 Ko.
 *
 * <p>Une premiere version de ce fichier essayait une preuve plus elegante :
 * <b>tronquer</b> le fichier de moitie, puis montrer qu'une tranche precoce se
 * lit encore. Elle a ete abandonnee parce qu'elle ne demontrait rien —
 * mesure faite, la bibliotheque ucar lit au-dela de la fin du fichier sans
 * lever d'exception, si bien que la lecture complete reussissait elle aussi.
 * Le test aurait passe au vert sans rien verifier.
 *
 * <p>Le second volet mesure ce que la lecture partielle est censee eviter : la
 * <b>taille de ce qui remonte</b>. Une coupe rend exactement lat x lon valeurs,
 * une animation 48 fois cela, et pas un octet de plus quelle que soit la
 * profondeur du fichier derriere.
 */
class PerformanceLectureTest {

	/** Assez de pas de temps et d'altitudes pour que « tout lire » coute cher. */
	private static final int N_TIME = 48;
	private static final int N_ALT = 60;
	private static final int N_LAT = 46;
	private static final int N_LON = 72;

	private static final String FICHIER = "MY35_Ls000_030_perf.nc";

	/** Le service, monte a la main : ce volet ne teste pas le routage HTTP. */
	private NetCDFReaderService lecteur(Path racineMean) {
		DataPathConfig config = mock(DataPathConfig.class);
		when(config.getMeanPath()).thenReturn(racineMean);
		when(config.getIndividualPath()).thenReturn(racineMean);
		return new NetCDFReaderService(config);
	}

	/**
	 * Ecrit une GEM-Mars miniature mais profonde : 48 x 60 x 46 x 72 flottants,
	 * soit environ 38 Mo pour la seule variable TT.
	 */
	private static void ecrire(Path chemin) throws Exception {
		NetcdfFormatWriter.Builder b = NetcdfFormatWriter.createNewNetcdf3(chemin.toString());
		b.addDimension("time", N_TIME);
		b.addDimension("altitudeT", N_ALT);
		b.addDimension("lat", N_LAT);
		b.addDimension("lon", N_LON);
		b.addVariable("TT", DataType.FLOAT, "time altitudeT lat lon")
				.addAttribute(new Attribute("units", "K"));
		b.addVariable("lat", DataType.DOUBLE, "lat");
		b.addVariable("lon", DataType.DOUBLE, "lon");
		b.addVariable("altitudeT", DataType.DOUBLE, "altitudeT");
		b.addVariable("time", DataType.DOUBLE, "time");

		try (NetcdfFormatWriter w = b.build()) {
			// Ecriture par tranche de temps : construire les 9,5 millions de
			// flottants d'un coup couterait plus de memoire au TEST qu'a
			// l'application qu'il surveille.
			for (int t = 0; t < N_TIME; t++) {
				ArrayFloat.D4 bloc = new ArrayFloat.D4(1, N_ALT, N_LAT, N_LON);
				for (int a = 0; a < N_ALT; a++) {
					for (int y = 0; y < N_LAT; y++) {
						for (int x = 0; x < N_LON; x++) {
							bloc.set(0, a, y, x, 1000f * t + 10f * a + y + x / 100f);
						}
					}
				}
				w.write(w.findVariable("TT"), new int[] { t, 0, 0, 0 }, bloc);
			}
			w.write(w.findVariable("lat"), axeRegulier(N_LAT, -90, 4));
			w.write(w.findVariable("lon"), axeRegulier(N_LON, -180, 5));
			w.write(w.findVariable("altitudeT"), axeRegulier(N_ALT, 0, 2));
			w.write(w.findVariable("time"), axeRegulier(N_TIME, 0, 0.5));
		}
	}

	private static ArrayDouble.D1 axeRegulier(int n, double debut, double pas) {
		ArrayDouble.D1 a = new ArrayDouble.D1(n);
		for (int i = 0; i < n; i++) {
			a.set(i, debut + i * pas);
		}
		return a;
	}

	// =========================================================================
	// Preuve deterministe : le fichier tronque
	// =========================================================================

	@Nested
	@DisplayName("une tranche s'extrait sans allouer le cube entier")
	class LecturePartielle {

		/** Octets alloues par le fil courant, ou -1 si la JVM ne le mesure pas. */
		private long alloues() {
			java.lang.management.ThreadMXBean brut = java.lang.management.ManagementFactory.getThreadMXBean();
			if (brut instanceof com.sun.management.ThreadMXBean precis
					&& precis.isThreadAllocatedMemorySupported()) {
				return precis.getCurrentThreadAllocatedBytes();
			}
			return -1L;
		}

		/** Taille du cube complet en octets : 48 x 60 x 46 x 72 flottants. */
		private long tailleDuCube() {
			return 4L * N_TIME * N_ALT * N_LAT * N_LON;
		}

		@Test
		@DisplayName("extraire une coupe alloue une fraction du cube, pas le cube")
		void coupeNAllouePasLeCube(@TempDir Path dir) throws Exception {
			Path f = dir.resolve(FICHIER);
			ecrire(f);
			NetCDFReaderService svc = lecteur(dir);
			org.junit.jupiter.api.Assumptions.assumeTrue(alloues() >= 0,
					"cette JVM ne mesure pas l'allocation par fil");

			// Premier appel a part : il porte le cout unique d'ouverture du
			// fichier et de mise en cache des axes, qui n'est pas ce qu'on mesure.
			svc.extractSlice2DWithCoords(FICHIER, "TT", 0, 0);

			long avant = alloues();
			svc.extractSlice2DWithCoords(FICHIER, "TT", 5, 30);
			long cout = alloues() - avant;

			long cube = tailleDuCube();
			assertThat(cout)
					.as("une coupe (%d Ko utiles) ne doit pas allouer les %d Mo du cube",
							4L * N_LAT * N_LON / 1024, cube / (1024 * 1024))
					.isLessThan(cube / 4);
		}

		/**
		 * L'animation est le cas le plus gourmand : 48 images. Elle lit une seule
		 * section couvrant tous les pas de temps a UNE altitude — donc un
		 * soixantieme du cube, pas le cube.
		 */
		@Test
		@DisplayName("l'animation alloue une altitude sur soixante, pas tout le cube")
		void animationNAlloueQuUneAltitude(@TempDir Path dir) throws Exception {
			Path f = dir.resolve(FICHIER);
			ecrire(f);
			NetCDFReaderService svc = lecteur(dir);
			org.junit.jupiter.api.Assumptions.assumeTrue(alloues() >= 0,
					"cette JVM ne mesure pas l'allocation par fil");

			svc.extractSlice2DWithCoords(FICHIER, "TT", 0, 0);

			long avant = alloues();
			AnimationData anim = svc.extractAnimationFrames(FICHIER, "TT", 0);
			long cout = alloues() - avant;

			assertThat(anim.frames()).hasSize(N_TIME);
			for (float[][] image : anim.frames()) {
				assertThat(image).hasDimensions(N_LAT, N_LON);
			}
			// Les 48 images font 48/60e de moins que le cube. La borne laisse
			// large : l'objet est de detecter une lecture TOTALE, pas de compter
			// les octets.
			assertThat(cout)
					.as("48 images a une altitude ne doivent pas couter les 60 altitudes")
					.isLessThan(tailleDuCube() / 2);
		}

		/**
		 * Le controle negatif, sans lequel les deux mesures precedentes ne
		 * prouveraient rien : une lecture VOLONTAIREMENT totale du meme fichier
		 * alloue bien l'ordre de grandeur du cube. Si ce test echouait, c'est la
		 * mesure elle-meme qui serait a revoir, pas l'application.
		 */
		@Test
		@DisplayName("temoin : lire tout le cube alloue bien le cube")
		void temoinLectureTotale(@TempDir Path dir) throws Exception {
			Path f = dir.resolve(FICHIER);
			ecrire(f);
			org.junit.jupiter.api.Assumptions.assumeTrue(alloues() >= 0,
					"cette JVM ne mesure pas l'allocation par fil");

			try (NetcdfFile nc = NetcdfFiles.open(f.toString())) {
				Variable tt = nc.findVariable("TT");
				assertThat(tt != null).as("la variable TT doit exister").isTrue();
				long avant = alloues();
				tt.read();
				long cout = alloues() - avant;
				assertThat(cout)
						.as("la mesure doit voir passer les %d Mo d'une lecture totale",
								tailleDuCube() / (1024 * 1024))
						.isGreaterThan(tailleDuCube() / 2);
			}
		}
	}

	// =========================================================================
	// Volume de ce qui remonte
	// =========================================================================

	@Nested
	@DisplayName("le volume rendu ne depend pas de la profondeur du fichier")
	class VolumeRendu {

		/**
		 * Une coupe rend lat x lon valeurs. Le fichier en contient
		 * {@code N_TIME * N_ALT} fois plus : c'est tout l'ecart que la lecture
		 * partielle economise, a chaque requete.
		 */
		@Test
		@DisplayName("une coupe rend lat x lon valeurs, soit 1/2880e du cube")
		void coupeRendUnSeulPlan(@TempDir Path dir) throws Exception {
			Path f = dir.resolve(FICHIER);
			ecrire(f);
			SliceData coupe = lecteur(dir).extractSlice2DWithCoords(FICHIER, "TT", 3, 7);

			long rendues = (long) N_LAT * N_LON;
			long dansLeFichier = (long) N_TIME * N_ALT * N_LAT * N_LON;
			assertThat(coupe.data().length * (long) coupe.data()[0].length).isEqualTo(rendues);
			assertThat(dansLeFichier / rendues)
					.as("rapport entre le cube et ce qu'une coupe en extrait")
					.isEqualTo(2880L);
		}

		/**
		 * La valeur lue doit venir du bon endroit. Une lecture partielle qui se
		 * trompe d'origine rendrait un tableau de la bonne TAILLE avec le
		 * MAUVAIS contenu — une erreur que seul un encodage des indices dans la
		 * donnee peut faire apparaitre.
		 */
		@Test
		@DisplayName("la tranche lue est bien celle demandee, pas la premiere venue")
		void trancheLueEstLaBonne(@TempDir Path dir) throws Exception {
			Path f = dir.resolve(FICHIER);
			ecrire(f);
			SliceData coupe = lecteur(dir).extractSlice2DWithCoords(FICHIER, "TT", 3, 7);

			// Encodage a l'ecriture : 1000*t + 10*alt + lat + lon/100.
			assertThat(coupe.data()[0][0]).isCloseTo(3070f, org.assertj.core.data.Offset.offset(1e-2f));
			assertThat(coupe.data()[5][0]).isCloseTo(3075f, org.assertj.core.data.Offset.offset(1e-2f));
		}
	}

	// =========================================================================
	// Cout d'un second appel
	// =========================================================================

	@Nested
	@DisplayName("les coordonnees ne sont lues qu'une fois par fichier")
	class CacheCoordonnees {

		/**
		 * Les axes lat/lon/altitude sont identiques pour toutes les requetes sur
		 * un meme fichier, donc {@code cachedCoordinates} les memorise. Le cache
		 * rend une COPIE : une vue qui trierait ses latitudes en place
		 * corromprait sinon toutes les vues suivantes, sur toute la duree de vie
		 * du processus.
		 *
		 * <p>C'est cette copie qui est verifiee ici, pas le gain de temps :
		 * modifier le tableau rendu ne doit rien changer a l'appel suivant.
		 */
		@Test
		@DisplayName("le cache rend une copie, pas l'entree partagee")
		void cacheRendUneCopie(@TempDir Path dir) throws Exception {
			Path f = dir.resolve(FICHIER);
			ecrire(f);
			NetCDFReaderService svc = lecteur(dir);

			SliceData premier = svc.extractSlice2DWithCoords(FICHIER, "TT", 0, 0);
			double avant = premier.latitudes()[0];
			premier.latitudes()[0] = -999.0;

			SliceData second = svc.extractSlice2DWithCoords(FICHIER, "TT", 1, 0);
			assertThat(second.latitudes()[0])
					.as("la corruption d'une vue ne doit pas atteindre la suivante")
					.isEqualTo(avant);
		}

		/**
		 * Le second appel doit etre servi sans relire les axes. La mesure est un
		 * RAPPORT entre deux appels sur la meme machine, pas un temps absolu :
		 * c'est ce qui la rend comparable d'un poste a l'autre. La borne est
		 * volontairement large — l'objet du test est de detecter une regression
		 * d'un ordre de grandeur, pas de mesurer finement.
		 */
		@Test
		@DisplayName("le second appel n'est pas plus lent que le premier")
		void secondAppelPasPlusLent(@TempDir Path dir) throws Exception {
			Path f = dir.resolve(FICHIER);
			ecrire(f);
			NetCDFReaderService svc = lecteur(dir);

			long t0 = System.nanoTime();
			svc.extractSlice2DWithCoords(FICHIER, "TT", 0, 0);
			long premier = System.nanoTime() - t0;

			// Minimum de trois tours, et non moyenne : une machine partagee ne
			// rend jamais un appel plus rapide qu'il ne l'est, elle le ralentit.
			// Le minimum estime donc le cout du code, la moyenne celui de la
			// machine — et c'est la seconde qui fait clignoter un test en CI.
			long cinqSuivants = Long.MAX_VALUE;
			for (int tour = 0; tour < 3; tour++) {
				long t1 = System.nanoTime();
				for (int i = 0; i < 5; i++) {
					svc.extractSlice2DWithCoords(FICHIER, "TT", i, 0);
				}
				cinqSuivants = Math.min(cinqSuivants, System.nanoTime() - t1);
			}

			assertThat(cinqSuivants)
					.as("cinq appels caches ne doivent pas couter dix fois le premier")
					.isLessThan(premier * 10);
		}
	}
}
