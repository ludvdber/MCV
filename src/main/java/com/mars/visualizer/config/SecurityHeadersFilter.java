package com.mars.visualizer.config;

import java.io.IOException;

import org.springframework.stereotype.Component;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Filtre ajoutant les en-têtes HTTP de sécurité à toutes les réponses.
 */
@Component
public class SecurityHeadersFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        if (response instanceof HttpServletResponse httpResponse) {
            httpResponse.setHeader("X-Content-Type-Options", "nosniff");
            httpResponse.setHeader("X-Frame-Options", "DENY");
            httpResponse.setHeader("Referrer-Policy", "no-referrer");
            httpResponse.setHeader("X-XSS-Protection", "0");
            httpResponse.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
            httpResponse.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
            httpResponse.setHeader("Content-Security-Policy",
                    "default-src 'self'; "
                    // NB : pas de worker-src blob: — troika-three-text (etiquettes du
                    // systeme solaire) est configure SANS worker (configureTextBuilder,
                    // SolarSystem.jsx) car son worker importe un second blob soumis a
                    // script-src ; la politique reste donc strictement inchangee.
                    + "script-src 'self' 'wasm-unsafe-eval'; "
                    // Polices auto-hebergees (public/fonts) : aucune reference a
                    // Google Fonts, donc pas d'allowance fonts.googleapis/gstatic.
                    + "style-src 'self' 'unsafe-inline'; "
                    + "font-src 'self'; "
                    + "img-src 'self' data: blob: https://images-assets.nasa.gov; "
                    + "connect-src 'self' blob: https://images-api.nasa.gov; "
                    + "object-src 'none'");
        }

        chain.doFilter(request, response);
    }
}
