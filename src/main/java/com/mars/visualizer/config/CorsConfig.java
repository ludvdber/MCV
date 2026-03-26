package com.mars.visualizer.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuration CORS centralisée.
 * L'origin autorisée est configurable via la propriété cors.allowed-origin
 * (défaut : http://localhost:5173 pour le dev Vite).
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${cors.allowed-origin:http://localhost:5173}")
    private String allowedOrigin;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns(allowedOrigin)
                .allowedMethods("GET", "OPTIONS")
                .allowedHeaders("Accept-Language", "Content-Type", "Accept")
                .maxAge(3600);
        // Swagger UI needs access to /v3/api-docs from same origin
        registry.addMapping("/v3/api-docs/**")
                .allowedOriginPatterns(allowedOrigin)
                .allowedMethods("GET");
    }
}
