package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;

import java.util.List;
import java.util.Locale;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.mars.visualizer.dto.internal.CoordonneeScalaire;
import com.mars.visualizer.dto.internal.ProvenanceTranche;
import com.mars.visualizer.dto.internal.VariableMetadata;
import com.mars.visualizer.service.NetCDFWriterService;
import com.mars.visualizer.util.CSVBuilder;

import ucar.nc2.NetcdfFile;
import ucar.nc2.NetcdfFiles;
import ucar.nc2.Variable;

/**
 * Contrat des fichiers exportés : ce que reçoit vraiment la personne qui clique
 * sur « Exporter ». Ni le CSV ni le NetCDF n'avaient de test, et les deux
 * portaient un défaut que seul un fichier réellement ouvert révèle.
 */
class ExportContractTest {

	private final Locale localeInitiale = Locale.getDefault();

	@AfterEach
	void restaureLocale() {
		Locale.setDefault(localeInitiale);
	}

	// =========================================================================
	// CSV
	// =========================================================================

	@Nested
	@DisplayName("Export CSV du profil temporel")
	class ProfilTemporel {

		private String enTete(Locale locale) {
			Locale.setDefault(locale);
			float[][] data = new float[3][48];
			double[] altitudes = {0.0, 10.0, 20.0};
			return CSVBuilder.temporalProfile(data, altitudes, 48).split("\n")[0];
		}

		@Test
		@DisplayName("L'en-tête garde le point décimal sur une JVM à virgule décimale")
		void pointDecimalMemeEnLocaleVirgule() {
			// fr_BE est la locale du poste de developpement ET celle d'un serveur
			// belge : c'est exactement la ou le bug se produisait.
			assertThat(enTete(Locale.forLanguageTag("fr-BE")))
					.as("L'heure doit s'ecrire t0.5h, jamais t0,5h")
					.contains("t0.5h")
					.doesNotContain("t0,5h");
		}

		@Test
		@DisplayName("Autant de colonnes dans l'en-tête que dans les données")
		void colonnesCoherentes() {
			for (Locale locale : List.of(Locale.forLanguageTag("fr-BE"), Locale.GERMANY,
					Locale.US, Locale.forLanguageTag("es-ES"))) {
				Locale.setDefault(locale);
				float[][] data = new float[3][48];
				double[] altitudes = {0.0, 10.0, 20.0};
				String[] lignes = CSVBuilder.temporalProfile(data, altitudes, 48).split("\n");

				int colonnesEnTete = lignes[0].split(",", -1).length;
				int colonnesDonnees = lignes[1].split(",", -1).length;

				assertThat(colonnesEnTete)
						.as("Locale %s : l'en-tete doit avoir 1 + 48 colonnes", locale)
						.isEqualTo(49);
				assertThat(colonnesDonnees)
						.as("Locale %s : en-tete et donnees doivent s'aligner", locale)
						.isEqualTo(colonnesEnTete);
			}
		}
	}

	// =========================================================================
	// NetCDF
	// =========================================================================

	@Nested
	@DisplayName("Export NetCDF")
	class ExportNetCDF {

		private final NetCDFWriterService writer = new NetCDFWriterService();

		private final double[] lat = {-45.0, 0.0, 45.0};
		private final double[] lon = {-90.0, 0.0, 90.0, 180.0};
		private final float[][] data = {
				{1f, 2f, 3f, 4f},
				{5f, Float.NaN, 7f, 8f},
				{9f, 10f, 11f, 12f}};

		/** Provenance typique d'un jeu MEAN : heure solaire locale + niveau. */
		private ProvenanceTranche provenanceMean(String datasetId, int timeIndex, int altIndex) {
			return new ProvenanceTranche(datasetId, "TT", timeIndex, altIndex, List.of(
					new CoordonneeScalaire("time", timeIndex * 0.5,
							new VariableMetadata("hours", null, "Hour of day (local solar time)"),
							"T", null),
					new CoordonneeScalaire("altitude", 1.25,
							new VariableMetadata("km", null, "Altitude on thermodynamic levels"),
							"Z", "up")));
		}

		private NetcdfFile ecrisEtRelis(VariableMetadata meta) throws Exception {
			return ecrisEtRelis(meta, provenanceMean("hl-b274_ls000_MY35", 0, 0));
		}

		private NetcdfFile ecrisEtRelis(VariableMetadata meta, ProvenanceTranche provenance)
				throws Exception {
			byte[] octets = writer.writeSliceNetCDF("TT", meta, lat, lon, data, provenance);
			return NetcdfFiles.openInMemory("export.nc", octets);
		}

		private float scalaire(NetcdfFile nc, String nom) throws Exception {
			return ((float[]) nc.findVariable(nom).read().copyTo1DJavaArray())[0];
		}

		@Test
		@DisplayName("Le fichier se relit et porte les vraies unités du fichier source")
		void portelesVraiesUnites() throws Exception {
			VariableMetadata meta = new VariableMetadata("K", "air_temperature", "Air temperature");

			try (NetcdfFile nc = ecrisEtRelis(meta)) {
				Variable tt = nc.findVariable("TT");
				// cast en Object : ucar.nc2.Variable satisfait plusieurs surcharges
				// d'assertThat, le compilateur ne peut pas trancher seul.
				assertThat((Object) tt).as("La variable exportee doit exister").isNotNull();

				assertThat(tt.findAttributeString("units", null))
						.as("Le fichier se declare CF-1.8 : units doit etre une unite UDUNITS reelle, "
								+ "pas le bouchon « see_source » que l'export ecrivait")
						.isEqualTo("K");
				assertThat(tt.findAttributeString("standard_name", null))
						.isEqualTo("air_temperature");
				assertThat(tt.findAttributeString("long_name", null))
						.as("long_name doit etre le libelle, pas le code de la variable")
						.isEqualTo("Air temperature");
			}
		}

		@Test
		@DisplayName("Les cellules masquées sont déclarées par _FillValue")
		void declareLeFillValue() throws Exception {
			try (NetcdfFile nc = ecrisEtRelis(new VariableMetadata("K", null, "Air temperature"))) {
				var fill = nc.findVariable("TT").findAttribute("_FillValue");
				assertThat(fill).as("Sans _FillValue, un outil CF lit les NaN comme des mesures").isNotNull();
				assertThat(fill.getNumericValue().floatValue()).isNaN();
			}
		}

		@Test
		@DisplayName("standard_name est omis quand le fichier source n'en porte pas")
		void nInventePasDeStandardName() throws Exception {
			try (NetcdfFile nc = ecrisEtRelis(new VariableMetadata("1", null, "Dust opacity"))) {
				assertThat(nc.findVariable("TT").findAttribute("standard_name"))
						.as("La liste CF des standard_name est normative : mieux vaut rien qu'un nom invente")
						.isNull();
			}
		}

		@Test
		@DisplayName("Une unité absente devient « unknown », jamais une chaîne vide")
		void uniteAbsente() throws Exception {
			try (NetcdfFile nc = ecrisEtRelis(new VariableMetadata(null, null, null))) {
				assertThat(nc.findVariable("TT").findAttributeString("units", null))
						.isEqualTo(VariableMetadata.UNITE_INCONNUE);
			}
		}

		@Test
		@DisplayName("Les attributs texte restent en ASCII")
		void attributsAscii() throws Exception {
			// NC_CHAR vaut un octet par caractere : un caractere accentue ressort
			// en plusieurs octets et devient du charabia cote lecteur.
			try (NetcdfFile nc = ecrisEtRelis(new VariableMetadata("K", null, "Température de l'air"))) {
				String lu = nc.findVariable("TT").findAttributeString("long_name", "");
				assertThat(lu).doesNotContain("é");
				for (char c : nc.getRootGroup().findAttributeString("source", "").toCharArray()) {
					assertThat((int) c).as("l'attribut source doit rester ASCII").isLessThan(128);
				}
			}
		}

		@Test
		@DisplayName("Un accent est retiré, pas remplacé par un point d'interrogation")
		void accentsReduitsSansPerte() throws Exception {
			try (NetcdfFile nc = ecrisEtRelis(new VariableMetadata("K", null, "Température de l'air"))) {
				assertThat(nc.findVariable("TT").findAttributeString("long_name", ""))
						.as("« Température » reste lisible en « Temperature »")
						.isEqualTo("Temperature de l'air");
			}
		}

		@Test
		@DisplayName("« µm » devient « um », jamais « ?m »")
		void translittereLesSymbolesScientifiques() throws Exception {
			// Mesure sur les donnees reelles : les trois variables de poussiere
			// declarent « Dust mixing ratio (0.1 µm) ». Le remplacement aveugle
			// par « ? » detruisait l'unite dans le seul attribut qui dit de
			// quelle grandeur il s'agit.
			VariableMetadata meta = new VariableMetadata("1", null, "Dust mixing ratio (0.1 µm)");
			try (NetcdfFile nc = ecrisEtRelis(meta)) {
				String lu = nc.findVariable("TT").findAttributeString("long_name", "");
				assertThat(lu).isEqualTo("Dust mixing ratio (0.1 um)");
				assertThat(lu).doesNotContain("?");
			}
		}

		@Test
		@DisplayName("Un symbole sans écriture ASCII reste un point d'interrogation")
		void dernierRecoursConserve() throws Exception {
			// Le repli doit survivre : la table ne pretend pas tout couvrir.
			try (NetcdfFile nc = ecrisEtRelis(new VariableMetadata("K", null, "Flux 中"))) {
				assertThat(nc.findVariable("TT").findAttributeString("long_name", ""))
						.isEqualTo("Flux ?");
			}
		}

		// =====================================================================
		// Provenance
		// =====================================================================

		@Test
		@DisplayName("Le fichier dit de quel jeu, quel instant et quel niveau il vient")
		void ecritLaProvenance() throws Exception {
			ProvenanceTranche p = provenanceMean("hl-b274_ls270_MY35", 24, 49);
			try (NetcdfFile nc = ecrisEtRelis(new VariableMetadata("K", "air_temperature", "Air temperature"), p)) {
				assertThat(nc.getRootGroup().findAttributeString("dataset_id", null))
						.as("sans dataset_id, deux saisons opposees donnent deux fichiers identiques")
						.isEqualTo("hl-b274_ls270_MY35");
				assertThat(nc.getRootGroup().findAttributeString("history", ""))
						.contains("hl-b274_ls270_MY35")
						.contains("time_index=24")
						.contains("altitude_index=49");

				assertThat((Object) nc.findVariable("time")).isNotNull();
				assertThat(scalaire(nc, "time")).isEqualTo(12.0f);
				assertThat(nc.findVariable("time").findAttributeString("units", null))
						.as("l'unite est RECOPIEE de la source, pas supposee")
						.isEqualTo("hours");
				assertThat(nc.findVariable("time").findAttributeString("axis", null)).isEqualTo("T");

				assertThat(scalaire(nc, "altitude")).isEqualTo(1.25f);
				assertThat(nc.findVariable("altitude").findAttributeString("units", null)).isEqualTo("km");
				assertThat(nc.findVariable("altitude").findAttributeString("positive", null))
						.isEqualTo("up");

				assertThat(nc.findVariable("TT").findAttributeString("coordinates", null))
						.as("CF-1.8 § 5.7 : sans « coordinates » les scalaires ne sont rattaches a rien")
						.isEqualTo("time altitude");
			}
		}

		@Test
		@DisplayName("Deux tranches différentes ne produisent plus deux fichiers identiques")
		void deuxTranchesNeSeConfondentPlus() throws Exception {
			// Le defaut d'origine, reproduit : meme variable, meme pas de temps,
			// meme altitude, deux jeux de saisons opposees.
			byte[] printemps = writer.writeSliceNetCDF("TT",
					new VariableMetadata("K", null, "Air temperature"), lat, lon, data,
					provenanceMean("hl-b274_ls000_MY35", 0, 0));
			byte[] ete = writer.writeSliceNetCDF("TT",
					new VariableMetadata("K", null, "Air temperature"), lat, lon, data,
					provenanceMean("hl-b274_ls270_MY35", 0, 0));

			assertThat(printemps)
					.as("les donnees sont les memes ici : seule la provenance doit les distinguer")
					.isNotEqualTo(ete);

			try (NetcdfFile a = NetcdfFiles.openInMemory("a.nc", printemps);
					NetcdfFile b = NetcdfFiles.openInMemory("b.nc", ete)) {
				assertThat(a.getRootGroup().findAttributeString("dataset_id", null))
						.isNotEqualTo(b.getRootGroup().findAttributeString("dataset_id", null));
			}
		}

		@Test
		@DisplayName("Le même extrait exporté deux fois donne deux fichiers identiques")
		void exportReproductible() throws Exception {
			// Pas d'horodatage dans history : sans cette discipline, plus rien
			// ne peut etre compare octet a octet, ni ici ni cote utilisateur.
			VariableMetadata meta = new VariableMetadata("K", null, "Air temperature");
			assertThat(writer.writeSliceNetCDF("TT", meta, lat, lon, data, provenanceMean("X", 3, 7)))
					.isEqualTo(writer.writeSliceNetCDF("TT", meta, lat, lon, data, provenanceMean("X", 3, 7)));
		}

		@Test
		@DisplayName("Une variable de surface n'invente pas d'altitude")
		void surfaceSansAltitude() throws Exception {
			ProvenanceTranche surface = new ProvenanceTranche("hl-b274_ls000_MY35", "MTSF", 12, null,
					List.of(new CoordonneeScalaire("time", 6.0,
							new VariableMetadata("hours", null, "Hour of day (local solar time)"),
							"T", null)));
			try (NetcdfFile nc = ecrisEtRelis(new VariableMetadata("K", null, "Surface temperature"), surface)) {
				assertThat((Object) nc.findVariable("altitude"))
						.as("MTSF n'a pas de niveau vertical : il ne faut pas en fabriquer un")
						.isNull();
				assertThat(nc.findVariable("TT").findAttributeString("coordinates", null))
						.isEqualTo("time");
				assertThat(nc.getRootGroup().findAttributeString("history", ""))
						.doesNotContain("altitude_index");
			}
		}

		@Test
		@DisplayName("Une provenance indisponible n'empêche pas l'export")
		void provenanceAbsenteNEmpechePasLExport() throws Exception {
			// Un fichier source exotique ne doit jamais coûter le telechargement :
			// on perd la tracabilite, pas les donnees.
			try (NetcdfFile nc = ecrisEtRelis(new VariableMetadata("K", null, "Air temperature"),
					ProvenanceTranche.inconnue())) {
				assertThat((Object) nc.findVariable("TT")).isNotNull();
				assertThat(nc.findVariable("TT").findAttribute("coordinates")).isNull();
				assertThat(nc.getRootGroup().findAttribute("dataset_id")).isNull();
				var lu = (float[]) nc.findVariable("TT").read().copyTo1DJavaArray();
				assertThat(lu).hasSize(12);
				assertThat(lu[11]).isEqualTo(12f);
			}
		}

		@Test
		@DisplayName("Les valeurs et les axes traversent l'export sans altération")
		void valeursFideles() throws Exception {
			try (NetcdfFile nc = ecrisEtRelis(new VariableMetadata("K", "air_temperature", "Air temperature"))) {
				var lu = (float[]) nc.findVariable("TT").read().copyTo1DJavaArray();
				assertThat(lu).hasSize(12);
				assertThat(lu[0]).isEqualTo(1f);
				assertThat(lu[5]).as("le NaN d'une cellule masquee doit survivre").isNaN();
				assertThat(lu[11]).isEqualTo(12f);

				var latLu = (float[]) nc.findVariable("lat").read().copyTo1DJavaArray();
				assertThat(latLu).containsExactly(-45f, 0f, 45f);
				var lonLu = (float[]) nc.findVariable("lon").read().copyTo1DJavaArray();
				assertThat(lonLu).containsExactly(-90f, 0f, 90f, 180f);
			}
		}
	}
}
