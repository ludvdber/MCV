package com.mars.visualizer.exception;

import lombok.Getter;

/**
 * Exception levée lors d'erreurs de lecture NetCDF.
 * Porte une clé i18n et des arguments pour résolution via MessageSource.
 *
 * @author Ludo
 * @version 2.0
 */
@Getter
public class NetCDFException extends RuntimeException {

    private final String messageKey;
    private final Object[] messageArgs;

    /**
     * @param messageKey clé i18n (ex: "error.netcdf.read.slice")
     * @param messageArgs arguments pour les placeholders {0}, {1}, …
     */
    public NetCDFException(String messageKey, Object... messageArgs) {
        super(messageKey);
        this.messageKey = messageKey;
        // Les arguments partent dans le corps de la reponse HTTP : un chemin
        // y est reduit a son nom de fichier, une valeur du client est bornee.
        // Voir MessageArgs pour le detail des deux fuites que cela ferme.
        this.messageArgs = MessageArgs.assainir(messageArgs);
    }

    /**
     * Avec cause technique. Throwable en PREMIER pour éviter l'ambiguïté varargs.
     *
     * @param cause exception technique d'origine (ex: IOException)
     * @param messageKey clé i18n
     * @param messageArgs arguments pour les placeholders
     */
    public NetCDFException(Throwable cause, String messageKey, Object... messageArgs) {
        super(messageKey, cause);
        this.messageKey = messageKey;
        this.messageArgs = MessageArgs.assainir(messageArgs);
    }
}
