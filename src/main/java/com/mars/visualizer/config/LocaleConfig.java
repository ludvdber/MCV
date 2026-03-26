package com.mars.visualizer.config;

import java.util.List;
import java.util.Locale;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

/**
 * Configuration du LocaleResolver basé sur l'en-tête Accept-Language.
 * Langues supportées : EN (défaut), FR, NL, ES, DE.
 */
@Configuration
public class LocaleConfig {

    @Bean
    public LocaleResolver localeResolver() {
        var resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(Locale.ENGLISH);
        resolver.setSupportedLocales(List.of(
                Locale.ENGLISH,
                Locale.FRENCH,
                Locale.forLanguageTag("nl"),
                Locale.forLanguageTag("es"),
                Locale.GERMAN
        ));
        return resolver;
    }
}
