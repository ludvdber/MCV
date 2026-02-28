package com.mars.visualizer.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuration CORS centralisée.
 * Remplace les @CrossOrigin(origins = "*") éparpillés dans les controllers.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("http://localhost:5173")
                .allowedMethods("GET", "OPTIONS")
                .allowedHeaders("Accept-Language", "Content-Type")
                .maxAge(3600);
    }
}
