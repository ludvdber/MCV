package com.mars.visualizer.dto;

import com.mars.visualizer.dto.response.IndividualYearInfo;

import java.util.List;

/**
 * DTO de sérialisation JSON pour le cache du catalogue INDIVIDUAL.
 * Record Java 21 — sérialisé/désérialisé nativement par Jackson 3.
 *
 * <p>{@code signature} est l'empreinte du contenu du dossier {@code individual/}
 * au moment du scan (nom et date de modification de chaque sous-répertoire).
 * Le cache n'est réutilisé que si l'empreinte recalculée au démarrage lui est
 * identique. Voir {@code IndividualCatalogService#computeSignature}.
 */
public record CatalogCache(
    String signature,
    List<IndividualYearInfo> yearInfos,
    List<CachedDirInfo> dirInfos
) {
    /**
     * Version sérialisable de {@code IndividualCatalogService.DirInfo}.
     *
     * <p>Le chemin du répertoire n'est <b>pas</b> mémorisé, seulement son nom.
     * Il l'était, sous forme absolue, et ce fichier voyage avec les données :
     * l'empreinte qui le valide ne retient que le nom et la date de chaque
     * sous-répertoire, si bien que déplacer {@code individual/} ne l'invalide
     * pas. Le catalogue était donc rechargé tel quel, avec des chemins pointant
     * vers l'ancienne machine, et chaque requête sur un jeu individuel échouait
     * en {@code error.individual.dir.read} pendant que le journal annonçait un
     * chargement réussi. Le chemin est désormais reconstruit à partir de
     * {@code netcdf.individual.path}, seule source de vérité.
     */
    public record CachedDirInfo(
        String dirName,
        double lsMin,
        double lsMax,
        int marsYear
    ) {}
}
