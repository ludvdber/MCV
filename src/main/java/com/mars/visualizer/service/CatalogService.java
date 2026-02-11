package com.mars.visualizer.service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.dto.response.DatasetMetadata;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import ucar.nc2.NetcdfFile;

/**
 * Service de gestion du catalogue des datasets MEAN.
 * Scanne le répertoire de données au démarrage de l'application
 * et maintient un cache en mémoire pour éviter les lectures répétées.
 * Pattern Spring @PostConstruct pour initialisation au boot.
 *
 * @author Ludo
 * @version 1.0
 */
@Service
@Slf4j
public class CatalogService {

    /**
     * Pattern d'extraction de l'année martienne depuis le nom de fichier.
     * Exemples supportés : MY24, MY_24, my24.
     */
    private static final Pattern PATTERN_MY = Pattern.compile("(?i)MY_?(\\d+)");

    /**
     * Pattern d'extraction de la plage Ls depuis le nom de fichier.
     * Exemples supportés : Ls000_030, Ls0_30, LS000-030.
     */
    private static final Pattern PATTERN_LS = Pattern.compile("(?i)Ls_?(\\d+)[_\\-](\\d+)");

    /** Noms standards des dimensions dans les fichiers NetCDF MEAN. */
    private static final String DIM_TIME     = "time";
    private static final String DIM_LAT      = "lat";
    private static final String DIM_LON      = "lon";
    private static final String DIM_ALTITUDE = "altitude";

    private final DataPathConfig pathConfig;
    private final NetCDFReaderService netcdfService;

    /**
     * Cache mémoire du catalogue. Évite les scans disque répétés.
     */
    private List<DatasetMetadata> catalog = new ArrayList<>();

    /**
     * Constructeur avec injection de dépendances.
     *
     * @param pathConfig    configuration des chemins NetCDF
     * @param netcdfService service de lecture des fichiers NetCDF
     */
    public CatalogService(DataPathConfig pathConfig, NetCDFReaderService netcdfService) {
        this.pathConfig = pathConfig;
        this.netcdfService = netcdfService;
    }

    /**
     * Initialise le catalogue au démarrage de l'application.
     * Scanne tous les fichiers .nc dans le répertoire MEAN,
     * extrait les métadonnées (MY, Ls, dimensions, variables),
     * et construit la liste des datasets disponibles.
     * Appelée automatiquement par Spring après injection des dépendances.
     */
    @PostConstruct
    public void initCatalog() {
        log.info("Initialisation du catalogue MEAN depuis : {}", pathConfig.getMeanPath());

        List<DatasetMetadata> built = new ArrayList<>();

        try {
            List<String> files = netcdfService.listMeanFiles();

            for (String filename : files) {
                try {
                    DatasetMetadata metadata = buildMetadata(filename);
                    built.add(metadata);
                    log.debug("Dataset indexé : {}", metadata.getId());
                } catch (Exception e) {
                    log.warn("Impossible d'indexer le fichier '{}' : {}", filename, e.getMessage());
                }
            }

        } catch (IOException e) {
            log.error("Erreur lors du scan du répertoire MEAN : {}", e.getMessage(), e);
        }

        this.catalog = Collections.unmodifiableList(built);
        log.info("Catalogue initialisé : {} datasets trouvés", catalog.size());
    }

    /**
     * Retourne le catalogue complet des datasets.
     *
     * @return liste des métadonnées de tous les datasets
     */
    public List<DatasetMetadata> getCatalog() {
        return catalog;
    }

    /**
     * Recherche un dataset par son identifiant.
     *
     * @param id identifiant du dataset (nom du fichier sans extension)
     * @return Optional contenant le dataset si trouvé
     */
    public Optional<DatasetMetadata> getDatasetById(String id) {
        log.debug("Recherche dataset : {}", id);
        return catalog.stream()
                .filter(d -> d.getId().equals(id))
                .findFirst();
    }

    /**
     * Vérifie l'existence d'un dataset.
     *
     * @param id identifiant du dataset
     * @return true si le dataset existe dans le catalogue
     */
    public boolean datasetExists(String id) {
        boolean exists = getDatasetById(id).isPresent();
        log.debug("Dataset '{}' existe : {}", id, exists);
        return exists;
    }


    /**
     * Construit les métadonnées complètes d'un fichier MEAN en une seule ouverture.
     * Variables et dimensions sont extraites dans le même try-with-resources
     * pour réduire les accès disque au démarrage.
     *
     * @param filename nom du fichier .nc
     * @return métadonnées du dataset
     * @throws IOException si erreur lecture NetCDF
     */
    private DatasetMetadata buildMetadata(String filename) throws IOException {
        String id = stripExtension(filename);

        Integer marsYear = parseMarsYear(filename);
        Integer lsStart  = parseLsStart(filename);

        // lsEnd calculé à partir de lsStart (pas parsé depuis le nom de fichier)
        Integer lsEnd = null;
        if (lsStart != null) {
            lsEnd = (lsStart == 330) ? 360 : lsStart + 30;
        }

        // Une seule ouverture pour variables + dimensions
        List<String> variables;
        Map<String, Integer> dimensions;

        try (NetcdfFile ncfile = netcdfService.openMeanFile(filename)) {

            // 1. Extraire les noms de variables
            variables = ncfile.getVariables().stream()
                    .map(ucar.nc2.Variable::getShortName)
                    .toList();

            // 2. Extraire les dimensions standards
            dimensions = new HashMap<>();
            for (ucar.nc2.Dimension dim : ncfile.getRootGroup().getDimensions()) {
                String name = dim.getShortName();
                if (name.equalsIgnoreCase(DIM_TIME)
                        || name.equalsIgnoreCase(DIM_LAT)
                        || name.equalsIgnoreCase(DIM_LON)
                        || name.equalsIgnoreCase(DIM_ALTITUDE)) {
                    dimensions.put(name.toLowerCase(), dim.getLength());
                }
            }
        }

        log.debug("Metadata extraites pour '{}' : {} variables, dimensions={}", filename, variables.size(), dimensions);

        return DatasetMetadata.builder()
                .id(id)
                .filename(filename)
                .marsYear(marsYear)
                .lsStart(lsStart)
                .lsEnd(lsEnd)
                .variables(variables)
                .dimensions(dimensions)
                .build();
    }

    /**
     * Retire l'extension {@code .nc} du nom de fichier pour obtenir l'identifiant.
     *
     * @param filename nom du fichier (ex: {@code MY24_Ls000_030.nc})
     * @return identifiant sans extension (ex: {@code MY24_Ls000_030})
     */
    private String stripExtension(String filename) {
        return filename.endsWith(".nc") ? filename.substring(0, filename.length() - 3) : filename;
    }

    /**
     * Tente d'extraire l'année martienne depuis le nom de fichier.
     * Retourne {@code null} si le pattern n'est pas trouvé.
     *
     * @param filename nom du fichier
     * @return année martienne ou null
     */
    private Integer parseMarsYear(String filename) {
        Matcher m = PATTERN_MY.matcher(filename);
        if (m.find()) {
            return Integer.parseInt(m.group(1));
        }
        log.debug("Année martienne non trouvée dans le nom de fichier : {}", filename);
        return null;
    }

    /**
     * Tente d'extraire le Ls de début depuis le nom de fichier.
     * Retourne {@code null} si le pattern n'est pas trouvé.
     *
     * @param filename nom du fichier
     * @return Ls de début ou null
     */
    private Integer parseLsStart(String filename) {
        Matcher m = PATTERN_LS.matcher(filename);
        if (m.find()) {
            return Integer.parseInt(m.group(1));
        }
        log.debug("Ls de début non trouvé dans le nom de fichier : {}", filename);
        return null;
    }

    /**
     * Retourne le nom de fichier complet (avec {@code .nc}) pour un identifiant de dataset.
     *
     * @param id identifiant du dataset (sans extension)
     * @return nom de fichier avec extension, ou {@code null} si non trouvé
     */
    public String getFilenameById(String id) {
        return catalog.stream()
                .filter(ds -> ds.getId().equals(id))
                .map(DatasetMetadata::getFilename)
                .findFirst()
                .orElse(null);
    }
}
