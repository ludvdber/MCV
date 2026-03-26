package com.mars.visualizer.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Forwarde toutes les routes SPA (non-API, non-fichier statique) vers index.html.
 * Permet le refresh du navigateur sur n'importe quelle page React (ex. /slice, /animation).
 */
@Configuration
public class SpaForwardingConfig implements WebMvcConfigurer {

	@Override
	public void addViewControllers(ViewControllerRegistry registry) {
		// Toute route SPA sans extension, hors /api, /swagger-ui, /api-docs → forward vers index.html
		registry.addViewController("/{path:(?!api|swagger-ui|api-docs|v3)[^\\.]*}").setViewName("forward:/index.html");
		registry.addViewController("/{path1:(?!api|swagger-ui|api-docs|v3)[^\\.]*}/{path2:[^\\.]*}").setViewName("forward:/index.html");
	}
}
