package com.mars.visualizer.exception;

/**
 * Exception levée lors d'erreurs de lecture NetCDF.
 * Utilisée pour encapsuler les IOException de la librairie ucar.nc2
 * et fournir un message d'erreur métier explicite.
 *
 * @author Ludo
 * @version 1.0
 */
public class NetCDFException extends RuntimeException {

    /**
     * Crée une exception avec un message d'erreur métier.
     *
     * @param message description de l'erreur
     */
    public NetCDFException(String message) {
        super(message);
    }

    /**
     * Crée une exception en encapsulant la cause technique originale.
     *
     * @param message description de l'erreur métier
     * @param cause   exception technique d'origine (ex: IOException ucar.nc2)
     */
    public NetCDFException(String message, Throwable cause) {
        super(message, cause);
    }
}
