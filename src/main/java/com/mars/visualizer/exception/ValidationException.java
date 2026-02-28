package com.mars.visualizer.exception;

import lombok.Getter;

/**
 * Exception levée lors de validation de paramètres invalides.
 * Porte une clé i18n et des arguments pour résolution via MessageSource.
 *
 * @author Ludo
 * @version 2.0
 */
@Getter
public class ValidationException extends RuntimeException {

    private final String messageKey;
    private final Object[] messageArgs;

    /**
     * @param messageKey clé i18n (ex: "error.variable.not.found")
     * @param messageArgs arguments pour les placeholders {0}, {1}, …
     */
    public ValidationException(String messageKey, Object... messageArgs) {
        super(messageKey);
        this.messageKey = messageKey;
        this.messageArgs = messageArgs;
    }
}
