package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.service.IndividualCatalogService;

import tools.jackson.databind.ObjectMapper;

/**
 * Le cache {@code .catalog-cache.json} doit refléter le contenu réel du dossier
 * {@code individual/}.
 *
 * <p>Le défaut corrigé : le cache était validé par la date de modification du
 * dossier RACINE. Or un système de fichiers ne met à jour la date d'un dossier
 * que lorsque ses propres entrées changent, si bien qu'un fichier ajouté dans un
 * sous-répertoire existant laissait le cache se croire valide, avec des bornes
 * Ls périmées, même après un redémarrage.
 */
@ExtendWith(MockitoExtension.class)
class IndividualCatalogCacheTest {

	private static final String CACHE = ".catalog-cache.json";

	@Mock
	private DataPathConfig pathConfig;

	/** Le vrai ObjectMapper : c'est la sérialisation réelle qu'on veut éprouver. */
	private final ObjectMapper objectMapper = new ObjectMapper();

	private IndividualCatalogService newService() {
		return new IndividualCatalogService(pathConfig, objectMapper);
	}

	/** Crée {@code dir/hl-b274_000000p_lsAAA_0000.nc} pour chaque Ls demandé. */
	private void writeNcFiles(Path dir, int... lsValues) throws IOException {
		Files.createDirectories(dir);
		for (int ls : lsValues) {
			Files.writeString(dir.resolve(String.format("hl-b274_000000p_ls%03d_0000.nc", ls)), "");
		}
	}

	/** Force la date de modification pour éviter toute dépendance à la granularité de l'horloge. */
	private void touch(Path dir, long millis) throws IOException {
		Files.setLastModifiedTime(dir, FileTime.fromMillis(millis));
	}

	@Test
	@DisplayName("Un .nc ajouté dans un sous-répertoire EXISTANT périme le cache")
	void ajoutDansSousRepertoireExistantPerimeLeCache(@TempDir Path root) throws IOException {
		when(pathConfig.getIndividualPath()).thenReturn(root);
		Path bloc = root.resolve("000960");
		writeNcFiles(bloc, 0, 10, 20);
		touch(bloc, 1_000_000_000_000L);

		// Deux démarrages d'abord, pour atteindre l'état où l'ancien contrôle
		// se croyait valide : au premier, l'écriture de .catalog-cache.json crée
		// une entrée dans individual/ et change donc la date du dossier racine ;
		// au second, le fichier existe déjà et n'est que réécrit, sans toucher à
		// cette date. C'est à partir du troisième démarrage que le cache était
		// réutilisé — et que le défaut se voyait vraiment.
		newService().initCatalog();
		IndividualCatalogService second = newService();
		second.initCatalog();
		assertThat(second.getAvailableYears().getFirst().lsMax())
			.as("état initial : Ls max = 20")
			.isCloseTo(20.0, within(0.01));

		// Nouveau fichier DANS le sous-répertoire : seule la date de 000960/
		// change, celle de individual/ reste identique.
		long racineAvant = Files.getLastModifiedTime(root).toMillis();
		writeNcFiles(bloc, 30);
		touch(bloc, 1_000_000_900_000L);
		assertThat(Files.getLastModifiedTime(root).toMillis())
			.as("la date du dossier racine ne bouge pas : c'est là que se cachait le défaut")
			.isEqualTo(racineAvant);

		IndividualCatalogService third = newService();
		third.initCatalog();

		assertThat(third.getAvailableYears().getFirst().lsMax())
			.as("le nouveau fichier Ls=30 doit être pris en compte au redémarrage")
			.isCloseTo(30.0, within(0.01));
	}

	@Test
	@DisplayName("Sans changement, le cache est bien réutilisé dès le deuxième démarrage")
	void cacheReutiliseSiRienNeChange(@TempDir Path root) throws IOException {
		when(pathConfig.getIndividualPath()).thenReturn(root);
		Path bloc = root.resolve("000960");
		writeNcFiles(bloc, 0, 10);
		touch(bloc, 1_000_000_000_000L);

		newService().initCatalog();
		String cacheApresPremier = Files.readString(root.resolve(CACHE));

		// L'écriture du cache crée une entrée dans individual/ et modifiait donc
		// sa date : l'ancienne version invalidait son propre cache et rescannait
		// une fois de plus. L'empreinte ne regarde que les sous-répertoires.
		IndividualCatalogService second = newService();
		second.initCatalog();

		assertThat(Files.readString(root.resolve(CACHE)))
			.as("aucun changement : le cache doit être réutilisé tel quel")
			.isEqualTo(cacheApresPremier);
		assertThat(second.getAvailableYears()).hasSize(1);
		assertThat(second.getAvailableYears().getFirst().lsMax()).isCloseTo(10.0, within(0.01));
	}

	@Test
	@DisplayName("Un .nc SUPPRIMÉ dans un sous-répertoire existant périme le cache")
	void suppressionDansSousRepertoireExistantPerimeLeCache(@TempDir Path root) throws IOException {
		when(pathConfig.getIndividualPath()).thenReturn(root);
		Path bloc = root.resolve("000960");
		writeNcFiles(bloc, 0, 10, 20, 30);
		touch(bloc, 1_000_000_000_000L);

		// Deux démarrages pour atteindre l'état où le cache est réellement réutilisé.
		newService().initCatalog();
		IndividualCatalogService second = newService();
		second.initCatalog();
		assertThat(second.getAvailableYears().getFirst().lsMax())
			.as("état initial : Ls max = 30")
			.isCloseTo(30.0, within(0.01));

		Files.delete(bloc.resolve("hl-b274_000000p_ls030_0000.nc"));
		touch(bloc, 1_000_000_900_000L);

		IndividualCatalogService third = newService();
		third.initCatalog();

		assertThat(third.getAvailableYears().getFirst().lsMax())
			.as("le fichier retiré ne doit plus borner l'année")
			.isCloseTo(20.0, within(0.01));
	}

	@Test
	@DisplayName("Un sous-répertoire SUPPRIMÉ périme le cache")
	void suppressionDeSousRepertoirePerimeLeCache(@TempDir Path root) throws IOException {
		when(pathConfig.getIndividualPath()).thenReturn(root);
		writeNcFiles(root.resolve("000960"), 0, 10);
		writeNcFiles(root.resolve("001920"), 20, 30);

		newService().initCatalog();
		IndividualCatalogService second = newService();
		second.initCatalog();
		assertThat(second.getAvailableYears().getFirst().directories()).hasSize(2);

		Files.delete(root.resolve("001920").resolve("hl-b274_000000p_ls020_0000.nc"));
		Files.delete(root.resolve("001920").resolve("hl-b274_000000p_ls030_0000.nc"));
		Files.delete(root.resolve("001920"));

		IndividualCatalogService third = newService();
		third.initCatalog();

		assertThat(third.getAvailableYears().getFirst().directories())
			.as("le bloc retiré ne doit plus figurer au catalogue")
			.containsExactly("000960");
	}

	@Test
	@DisplayName("Un nouveau sous-répertoire périme le cache")
	void nouveauSousRepertoirePerimeLeCache(@TempDir Path root) throws IOException {
		when(pathConfig.getIndividualPath()).thenReturn(root);
		writeNcFiles(root.resolve("000960"), 0, 10);

		newService().initCatalog();

		writeNcFiles(root.resolve("001920"), 20, 30);

		IndividualCatalogService second = newService();
		second.initCatalog();

		assertThat(second.getAvailableYears().getFirst().lsMax())
			.as("le second bloc doit être scanné")
			.isCloseTo(30.0, within(0.01));
	}

	@Test
	@DisplayName("Un cache tronqué ne bloque pas le démarrage : rescan complet")
	void cacheCorrompuNeBloquePasLeDemarrage(@TempDir Path root) throws IOException {
		when(pathConfig.getIndividualPath()).thenReturn(root);
		writeNcFiles(root.resolve("000960"), 0, 10);

		// JSON volontairement tronqué, comme après une écriture interrompue.
		// Jackson 3 lève une exception NON VÉRIFIÉE : le catch (IOException)
		// d'origine ne l'attrapait pas et le démarrage échouait.
		Files.writeString(root.resolve(CACHE), "{\"signature\":\"000960:1\",\"yearInfos\":[{\"marsYear\"");

		IndividualCatalogService service = newService();
		assertThatCode(service::initCatalog)
			.as("un cache corrompu doit dégrader vers un scan complet, pas faire échouer le démarrage")
			.doesNotThrowAnyException();

		assertThat(service.getAvailableYears())
			.as("le catalogue doit être reconstruit depuis le disque")
			.hasSize(1);
		assertThat(service.getAvailableYears().getFirst().lsMax()).isCloseTo(10.0, within(0.01));
	}

	@Test
	@DisplayName("Aucun fichier temporaire ne subsiste après l'écriture du cache")
	void pasDeFichierTemporaireResiduel(@TempDir Path root) throws IOException {
		when(pathConfig.getIndividualPath()).thenReturn(root);
		writeNcFiles(root.resolve("000960"), 0, 10);

		newService().initCatalog();

		assertThat(root.resolve(CACHE + ".tmp"))
			.as("l'écriture passe par un temporaire, qui doit être renommé et non laissé sur place")
			.doesNotExist();
	}
}
