package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

import java.nio.file.Path;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.mars.visualizer.exception.ValidationException;
import com.mars.visualizer.service.CatalogService;
import com.mars.visualizer.service.IndividualCatalogService;
import com.mars.visualizer.util.DatasetResolver;

/**
 * L'identifiant d'un jeu INDIVIDUAL, tel qu'il arrive dans une URL.
 *
 * <p>{@code IND_MY{annee}_LS{ls}} est ecrit par le frontend mais surtout copie,
 * partage et modifie a la main dans les permaliens. Tout ce qui en sort doit
 * donc etre traite comme une entree inconnue : c'est ce que
 * {@code resolveFilename} decide avant qu'un seul octet ne soit lu sur le
 * disque.
 *
 * <p>{@code DatasetResolverTest} couvre le format invalide et le cas MEAN.
 * Restent les bornes, et surtout la NORMALISATION CYCLIQUE : Ls 360 et Ls 0
 * designent le meme instant de l'annee martienne. Les laisser diverger enverrait
 * deux permaliens equivalents vers deux fichiers differents, aux deux bouts de
 * l'annee. C'est la meme famille de defaut que celle deja corrigee dans
 * {@code TidesCalculator}, ou une phase pouvait sortir egale a sa periode.
 */
@ExtendWith(MockitoExtension.class)
class DatasetResolverIndividuelTest {

	@Mock
	private CatalogService catalogService;

	@Mock
	private IndividualCatalogService individualCatalogService;

	private DatasetResolver resolveur() {
		return new DatasetResolver(catalogService, individualCatalogService);
	}

	@Nested
	@DisplayName("Normalisation cyclique de la Ls")
	class Cyclique {

		/**
		 * Le coeur du test : on capture la Ls REELLEMENT transmise au catalogue,
		 * plutot que de se contenter d'un appel qui n'echoue pas. Sans cette
		 * capture, un resolveur qui passerait 360 tel quel rendrait le test vert
		 * tout en resolvant vers le dernier fichier de l'annee au lieu du
		 * premier.
		 */
		@Test
		@DisplayName("Ls 360 est ramenee a 0, car les deux designent le meme instant")
		void ls360DevientZero() {
			when(individualCatalogService.findClosestFile(anyInt(), anyDouble()))
					.thenReturn(Path.of("fichier.nc"));

			resolveur().resolveFilename("IND_MY35_LS360");

			ArgumentCaptor<Double> ls = ArgumentCaptor.forClass(Double.class);
			verify(individualCatalogService).findClosestFile(eq(35), ls.capture());
			assertThat(ls.getValue())
					.as("Ls 360 doit atteindre le catalogue comme 0, pas comme 360")
					.isEqualTo(0.0);
		}

		@Test
		@DisplayName("Ls 0 et Ls 360 resolvent vers le meme fichier")
		void memeInstantMemeFichier() {
			when(individualCatalogService.findClosestFile(anyInt(), anyDouble()))
					.thenReturn(Path.of("fichier.nc"));

			DatasetResolver r = resolveur();
			assertThat(r.resolveFilename("IND_MY35_LS360"))
					.isEqualTo(r.resolveFilename("IND_MY35_LS0"));
		}

		/**
		 * 359,99 n'est pas 360 : la normalisation ne doit pas mordre sur les
		 * valeurs voisines, sinon la derniere fraction de l'annee martienne
		 * deviendrait inatteignable.
		 */
		@Test
		@DisplayName("Une Ls juste sous 360 n'est pas normalisee")
		void justeSous360() {
			when(individualCatalogService.findClosestFile(anyInt(), anyDouble()))
					.thenReturn(Path.of("fichier.nc"));

			resolveur().resolveFilename("IND_MY35_LS359.99");

			ArgumentCaptor<Double> ls = ArgumentCaptor.forClass(Double.class);
			verify(individualCatalogService).findClosestFile(eq(35), ls.capture());
			assertThat(ls.getValue()).isEqualTo(359.99);
		}
	}

	@Nested
	@DisplayName("Bornes refusees avant toute lecture")
	class Bornes {

		/**
		 * Une Ls hors de l'annee n'a pas de sens astronomique. On la refuse ici
		 * plutot que de laisser le catalogue chercher le fichier « le plus
		 * proche », qui rendrait silencieusement une extremite.
		 */
		@Test
		@DisplayName("Une Ls superieure a 360 est refusee")
		void lsTropGrande() {
			assertThatThrownBy(() -> resolveur().resolveFilename("IND_MY35_LS400"))
					.isInstanceOf(ValidationException.class);
			verifyNoInteractions(individualCatalogService);
		}

		@Test
		@DisplayName("Une annee martienne hors plage est refusee")
		void anneeHorsPlage() {
			assertThatThrownBy(() -> resolveur().resolveFilename("IND_MY999_LS10"))
					.isInstanceOf(ValidationException.class);
			verifyNoInteractions(individualCatalogService);
		}

		/**
		 * Le motif accepte une suite de chiffres sans borne de longueur : une
		 * valeur qui deborde d'un {@code int} passe donc le filtre du motif et
		 * n'echoue qu'a la conversion. Sans la capture de NumberFormatException,
		 * cette entree ressortirait en 500 au lieu de 400.
		 */
		@Test
		@DisplayName("Un nombre trop grand pour un entier reste une erreur de validation")
		void nombreQuiDeborde() {
			assertThatThrownBy(() -> resolveur().resolveFilename("IND_MY99999999999999_LS10"))
					.as("un debordement doit rester une entree invalide, pas une panne")
					.isInstanceOf(ValidationException.class);
			verifyNoInteractions(individualCatalogService);
		}

		@Test
		@DisplayName("Une Ls malformee est refusee")
		void lsMalformee() {
			assertThatThrownBy(() -> resolveur().resolveFilename("IND_MY35_LS1.2.3"))
					.isInstanceOf(ValidationException.class);
			verifyNoInteractions(individualCatalogService);
		}

		@Test
		@DisplayName("Les bornes valides passent : annee 0 et Ls 0")
		void bornesValides() {
			when(individualCatalogService.findClosestFile(anyInt(), anyDouble()))
					.thenReturn(Path.of("fichier.nc"));

			assertThatNoException()
					.isThrownBy(() -> resolveur().resolveFilename("IND_MY0_LS0"));
		}
	}

	@Nested
	@DisplayName("Ls reelle du fichier resolu")
	class LsReelle {

		/**
		 * La Ls demandee et celle du fichier servi different presque toujours :
		 * le catalogue rend le fichier le plus proche. L'API doit donc pouvoir
		 * annoncer les deux, comme le fait deja /timeseries pour la latitude.
		 */
		@Test
		@DisplayName("Un jeu individuel expose la Ls du fichier reellement lu")
		void lsDuFichierServi() {
			when(individualCatalogService.getActualLs(any(Path.class))).thenReturn(12.5);

			assertThat(resolveur().getActualLs("IND_MY35_LS10", "/donnees/fichier.nc"))
					.isEqualTo(12.5);
		}

		@Test
		@DisplayName("Un jeu MEAN n'a pas de Ls de fichier")
		void meanSansLs() {
			assertThat(resolveur().getActualLs("mean_MY28_Ls0_30", "/donnees/fichier.nc")).isNull();
			verifyNoInteractions(individualCatalogService);
		}
	}
}
