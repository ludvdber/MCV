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
                    + "script-src 'self' 'wasm-unsafe-eval'; "
                    + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                    + "font-src 'self' https://fonts.gstatic.com; "
                    + "img-src 'self' data: blob: https://images-assets.nasa.gov; "
                    + "connect-src 'self' blob: https://images-api.nasa.gov https://fonts.googleapis.com https://fonts.gstatic.com; "
                    + "object-src 'none'");
        }

        chain.doFilter(request, response);
    }
}
