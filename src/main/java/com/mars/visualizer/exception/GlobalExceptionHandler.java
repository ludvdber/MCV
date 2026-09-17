package com.mars.visualizer.exception;

import java.time.Instant;
import java.util.Locale;

import org.apache.catalina.connector.ClientAbortException;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import jakarta.servlet.http.HttpServletResponse;
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

    /**
     * Methode HTTP non supportee : 405, et non 500.
     *
     * <p>Sans ce gestionnaire, {@code handleGenericException} attrapait
     * l'exception et repondait 500 en journalisant une trace complete au
     * niveau ERROR. Un simple POST sur un endpoint de lecture suffisait donc
     * a faire mentir le code de retour et a remplir le journal : les robots
     * qui balaient un site public font exactement cela.
     *
     * <p>L'en-tete {@code Allow} est obligatoire pour un 405 (RFC 9110).
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        Locale locale = LocaleContextHolder.getLocale();
        String error   = messageSource.getMessage("error.category.method", null, locale);
        String message = messageSource.getMessage("error.method.notsupported",
                new Object[]{ex.getMethod()}, locale);
        log.warn("Method not allowed: {}", sanitizeLog(ex.getMethod()));

        ResponseEntity.BodyBuilder reponse = ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED);
        var autorisees = ex.getSupportedHttpMethods();
        if (autorisees != null && !autorisees.isEmpty()) {
            reponse.allow(autorisees.toArray(new org.springframework.http.HttpMethod[0]));
        }
        return reponse.body(buildErrorBody(error, message));
    }

    /**
     * Le visiteur a raccroche : onglet ferme, navigation, requete annulee.
     *
     * <p>Les DEUX types sont necessaires. Tomcat leve
     * {@link ClientAbortException}, mais Spring l'ENVELOPPE dans
     * {@link AsyncRequestNotUsableException} avant que la resolution des
     * exceptions n'entre en jeu, et cette resolution se fait sur le type LEVE,
     * jamais sur la cause. N'enregistrer que le premier laissait donc le
     * fourre-tout attraper l'enveloppe : mesure en production, 76 lignes de
     * trace au niveau ERROR et un 500 annonce, pour un onglet ferme.
     *
     * <p>La methode rend {@code void} : la connexion n'existe plus, il n'y a
     * personne pour lire une reponse. C'est aussi ce qui evite la panne
     * suivante, car tenter d'ecrire un corps sur une reponse deja partie fait
     * echouer le gestionnaire lui-meme.
     */
    /**
     * Le client demande un format que l'API ne sert pas, ou envoie un en-tete
     * {@code Accept} illisible. Dans les deux cas c'est 406, et dans les deux
     * cas la reponse n'a PAS de corps : le client vient precisement de dire
     * qu'il n'accepte pas le JSON, ecrire du JSON n'aurait aucun sens et c'est
     * ce qui faisait echouer le gestionnaire lui-meme.
     *
     * <p>Sans ce traitement, les deux cas partaient au fourre-tout et se
     * separaient de facon instructive, mesure sur le serveur reel :
     *
     * <ul>
     * <li>{@code Accept: text/html} sur /api/catalog — le fourre-tout
     *     journalisait ERROR « Unexpected: No acceptable representation »,
     *     n'arrivait pas a ecrire son corps, ajoutait un WARN
     *     « Failure in @ExceptionHandler », puis Spring reprenait la main et
     *     repondait un 406 correct. Statut juste, journal alarmant.</li>
     * <li>{@code Accept: pas-un-type} — l'en-tete etant illisible, Spring se
     *     rabat sur « tout est acceptable », le fourre-tout REUSSISSAIT donc a
     *     ecrire son corps et repondait <b>500</b>. Un en-tete mal forme d'un
     *     robot suffisait a faire dire a l'API qu'elle avait plante.</li>
     * </ul>
     *
     * <p>Meme famille que le 405 ci-dessus : une exception du cadre qui porte
     * deja son statut doit etre traitee explicitement, sans quoi le
     * {@code @ExceptionHandler(Exception.class)} la prend de vitesse — il
     * s'execute avant {@code DefaultHandlerExceptionResolver}.
     */
    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
    public ResponseEntity<Void> handleNotAcceptable(HttpMediaTypeNotAcceptableException ex) {
        log.debug("Not acceptable: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_ACCEPTABLE).build();
    }

    @ExceptionHandler({ ClientAbortException.class, AsyncRequestNotUsableException.class })
    public void handleClientAbort(Exception ex) {
        log.debug("Client disconnected: {}", ex.getMessage());
    }

    /**
     * Le client a-t-il disparu, a n'importe quelle profondeur de la chaine des
     * causes ?
     *
     * <p>La question se pose parce que la deconnexion n'arrive pas toujours
     * nue. Mesure en forcant l'echec d'ecriture sur une grosse reponse coupee
     * par RST, il en existe au moins deux emballages differents selon le
     * chemin :
     *
     * <pre>
     * page HTML : AsyncRequestNotUsableException: ServletResponse failed to
     *             flushBuffer -&gt; IOException: Broken pipe
     * API JSON  : HttpMessageNotWritableException: Could not write JSON
     *             -&gt; AsyncRequestNotUsableException: ServletOutputStream
     *                failed to write -&gt; IOException: Connection reset by peer
     * </pre>
     *
     * <p>La resolution de Spring choisit une methode sur le type LEVE, elle ne
     * regarde jamais la cause : le second cas atterrit donc au fourre-tout
     * quoi qu'on declare plus haut. On teste des TYPES et non des messages,
     * qui dependent du systeme et de sa langue.
     *
     * <p>Le garde-fou {@code c != c.getCause()} evite une boucle infinie sur
     * une exception qui se designe elle-meme comme sa propre cause.
     */
    private static boolean clientParti(Throwable t) {
        for (Throwable c = t; c != null && c != c.getCause(); c = c.getCause()) {
            if (c instanceof ClientAbortException || c instanceof AsyncRequestNotUsableException) {
                return true;
            }
        }
        return false;
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException ex) {
        log.debug("Static resource not found: {}", ex.getResourcePath());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(buildErrorBody("Not Found", "The requested resource was not found"));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        Locale locale = LocaleContextHolder.getLocale();
        String message = messageSource.getMessage(ex.getMessageKey(), ex.getMessageArgs(), locale);
        log.warn("Not found [{}]: {}", ex.getMessageKey(), message);

        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(buildErrorBody("Not Found", message));
    }

    /**
     * Filet de derniere instance.
     *
     * <p>Une exception survenue APRES le debut de l'envoi ne peut plus donner
     * lieu a une reponse d'erreur : le statut est parti, le type de contenu
     * est fige. Rendre un ErrorResponse revient alors a demander a Spring
     * d'ecrire du JSON dans une reponse annoncee en {@code text/html} — les
     * routes SPA passent par {@code forward:/index.html}, qui pose ce
     * type — et aucun convertisseur ne s'applique. Le gestionnaire echoue a
     * son tour, ce qui ajoute au journal un
     * {@code Failure in @ExceptionHandler} donnant a croire que le code de
     * gestion d'erreur est casse, alors que la seule chose a faire etait de
     * renoncer.
     *
     * <p>On renonce donc, sans se taire : la cause reste journalisee.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex, HttpServletResponse reponse) {
        // Une deconnexion emballee dans autre chose n'est pas une panne du
        // serveur : personne n'attend plus de reponse, et la journaliser en
        // ERROR avec sa trace remplit le journal de bruit qu'aucun exploitant
        // ne peut traiter.
        if (clientParti(ex)) {
            log.debug("Client disconnected: {}", ex.getMessage());
            return null;
        }

        log.error("Unexpected: {}", ex.getMessage(), ex);

        if (reponse.isCommitted()) {
            log.debug("Reponse deja envoyee : aucun corps d'erreur ne peut plus etre ecrit");
            return null;
        }

        Locale locale = LocaleContextHolder.getLocale();
        String error   = messageSource.getMessage("error.category.internal", null, locale);
        String message = messageSource.getMessage("error.generic", null, locale);

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
