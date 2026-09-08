package com.mars.visualizer.exception;

import lombok.Getter;

/**
 * Exception levée lorsqu'une ressource demandée (jeu de données, fichier) est introuvable.
 * Mappée sur un HTTP 404 par le GlobalExceptionHandler.
 *
 * @author Ludo
 * @version 1.0
 */
@Getter
public class ResourceNotFoundException extends RuntimeException {

    private final String messageKey;
    private final Object[] messageArgs;

    public ResourceNotFoundException(String messageKey, Object... messageArgs) {
        super(messageKey);
        this.messageKey = messageKey;
        // Les arguments partent dans le corps de la reponse HTTP : un chemin
        // y est reduit a son nom de fichier, une valeur du client est bornee.
        // Voir MessageArgs pour le detail des deux fuites que cela ferme.
        this.messageArgs = MessageArgs.assainir(messageArgs);
    }
}
