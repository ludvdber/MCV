package com.mars.visualizer.exception;

import java.time.Instant;
import java.util.Locale;

import org.apache.catalina.connector.ClientAbortException;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import lombok.extern.slf4j.Slf4j;

/**
 * Gestionnaire global des exceptions REST.
 * Résout les clés i18n portées par les exceptions via MessageSource
 * en utilisant la locale de la requête HTTP (Accept-Language).
 *
 * @author Ludo
 * @version 3.0
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /** Record immuable pour les réponses d'erreur JSON. */
    public record ErrorResponse(String error, String message, String timestamp) {}

    private final MessageSource messageSource;

    public GlobalExceptionHandler(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    @ExceptionHandler(NetCDFException.class)
    public ResponseEntity<ErrorResponse> handleNetCDFException(NetCDFException ex) {
        Locale locale = LocaleContextHolder.getLocale();
        String error   = messageSource.getMessage("error.category.netcdf", null, locale);
        String message = messageSource.getMessage(ex.getMessageKey(), ex.getMessageArgs(), locale);
        log.error("NetCDF [{}]: {}", ex.getMessageKey(), message, ex);

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(buildErrorBody(error, message));
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(ValidationException ex) {
        Locale locale = LocaleContextHolder.getLocale();
        String error   = messageSource.getMessage("error.category.validation", null, locale);
        String message = messageSource.getMessage(ex.getMessageKey(), ex.getMessageArgs(), locale);
        log.warn("Validation [{}]: {}", ex.getMessageKey(), message);

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(buildErrorBody(error, message));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException ex) {
        Locale locale = LocaleContextHolder.getLocale();
        String error   = messageSource.getMessage("error.category.validation", null, locale);
        String message = messageSource.getMessage("error.parameter.missing",
                new Object[]{ex.getParameterName()}, locale);
        log.warn("Missing parameter: {}", sanitizeLog(ex.getParameterName()));

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(buildErrorBody(error, message));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        Locale locale = LocaleContextHolder.getLocale();
        String error   = messageSource.getMessage("error.category.validation", null, locale);
        String message = messageSource.getMessage("error.parameter.invalid",
                new Object[]{ex.getName()}, locale);
        log.warn("Type mismatch on parameter: {}", sanitizeLog(ex.getName()));

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(buildErrorBody(error, message));
    }

    @ExceptionHandler(ClientAbortException.class)
    public void handleClientAbort(ClientAbortException ex) {
        log.debug("Client disconnected: {}", ex.getMessage());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException ex) {
        log.debug("Static resource not found: {}", ex.getResourcePath());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(buildErrorBody("Not Found", "The requested resource was not found"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        Locale locale = LocaleContextHolder.getLocale();
        String error   = messageSource.getMessage("error.category.internal", null, locale);
        String message = messageSource.getMessage("error.generic", null, locale);
        log.error("Unexpected: {}", ex.getMessage(), ex);

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(buildErrorBody(error, message));
    }

    private ErrorResponse buildErrorBody(String error, String message) {
        return new ErrorResponse(error, message, Instant.now().toString());
    }

    /** Prevent log injection by stripping CR/LF from user-supplied values. */
    private static String sanitizeLog(String input) {
        return input == null ? "" : input.replaceAll("[\\r\\n]", " ");
    }
}
