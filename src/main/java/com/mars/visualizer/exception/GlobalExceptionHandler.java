package com.mars.visualizer.exception;

import java.time.Instant;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import lombok.extern.slf4j.Slf4j;

/**
 * Gestionnaire global des exceptions REST.
 * Intercepte toutes les exceptions non catchées dans les controllers
 * et les transforme en réponses HTTP appropriées.
 * Implémente le pattern Spring @ControllerAdvice pour centraliser
 * la gestion d'erreurs de l'API.
 *
 * @author Ludo
 * @version 1.0
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /**
     * Gère les erreurs de lecture NetCDF.
     * Retourne un HTTP 500 avec le message d'erreur métier.
     *
     * @param ex exception NetCDF levée par le service
     * @return réponse 500 avec détails de l'erreur
     */
    @ExceptionHandler(NetCDFException.class)
    public ResponseEntity<Map<String, Object>> handleNetCDFException(NetCDFException ex) {
        log.error("Erreur NetCDF : {}", ex.getMessage(), ex);

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(buildErrorBody("Erreur lecture NetCDF", ex.getMessage()));
    }

    /**
     * Gère les erreurs de validation de paramètres.
     * Retourne un HTTP 400 avec le message décrivant le paramètre invalide.
     *
     * @param ex exception de validation levée par le service ou le controller
     * @return réponse 400 avec détails de l'erreur
     */
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<Map<String, Object>> handleValidationException(ValidationException ex) {
        log.warn("Erreur de validation : {}", ex.getMessage());

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(buildErrorBody("Paramètre invalide", ex.getMessage()));
    }

    /**
     * Gère toutes les exceptions non prévues (catch-all).
     * Retourne un HTTP 500 générique sans exposer les détails techniques.
     *
     * @param ex exception inattendue
     * @return réponse 500 générique
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        log.error("Erreur inattendue : {}", ex.getMessage(), ex);

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(buildErrorBody("Erreur interne du serveur", "Une erreur inattendue s'est produite."));
    }

    /**
     * Construit le corps de réponse d'erreur standardisé.
     *
     * @param error   catégorie de l'erreur
     * @param message message détaillé
     * @return map contenant {@code error}, {@code message} et {@code timestamp}
     */
    private Map<String, Object> buildErrorBody(String error, String message) {
        return Map.of(
                "error", error,
                "message", message,
                "timestamp", Instant.now().toString()
        );
    }
}
