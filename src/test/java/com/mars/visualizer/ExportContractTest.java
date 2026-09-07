package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;

import java.util.List;
import java.util.Locale;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

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

		private NetcdfFile ecrisEtRelis(VariableMetadata meta) throws Exception {
			byte[] octets = writer.writeSliceNetCDF("TT", meta, lat, lon, data);
			return NetcdfFiles.openInMemory("export.nc", octets);
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
