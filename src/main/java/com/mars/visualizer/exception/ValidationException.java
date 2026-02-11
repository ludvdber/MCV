package com.mars.visualizer.exception;

/**
 * Exception levée lors de validation de paramètres invalides.
 * Permet de retourner un code HTTP 400 (Bad Request) à l'utilisateur
 * avec un message clair sur l'erreur de saisie.
 *
 * @author Ludo
 * @version 1.0
 */
public class ValidationException extends RuntimeException {

    /**
     * Crée une exception de validation avec un message décrivant le paramètre invalide.
     *
     * @param message description de l'erreur de validation
     */
    public ValidationException(String message) {
        super(message);
    }
}
