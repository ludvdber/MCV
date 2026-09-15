package com.mars.visualizer.config;

import org.springframework.boot.diagnostics.AbstractFailureAnalyzer;
import org.springframework.boot.diagnostics.FailureAnalysis;

/**
 * Remplace la trace de pile par le bloc que Spring Boot reserve aux pannes
 * qu'il sait expliquer, celui qu'on voit deja pour un port occupe.
 *
 * <p>Il n'y a aucune information nouvelle ici : le texte etait deja dans
 * l'exception. Ce qui change est qu'il devient LISIBLE. Spring Boot imprime
 * alors « APPLICATION FAILED TO START », la description, l'action, et relegue
 * la trace de pile au niveau DEBUG — donc elle reste disponible pour qui la
 * demande, sans etre imposee a qui voulait juste savoir quelle ligne remplir.
 *
 * <p>La classe est enregistree dans {@code META-INF/spring.factories}. Rien
 * dans le code ne la reference, donc rien ne se plaindrait si cet
 * enregistrement disparaissait : la console reviendrait silencieusement a la
 * trace de pile. C'est exactement pourquoi
 * {@code ConfigurationFailureAnalyzerTest} lit ce fichier plutot que la classe.
 */
public class ConfigurationFailureAnalyzer
		extends AbstractFailureAnalyzer<ConfigurationInvalideException> {

	@Override
	protected FailureAnalysis analyze(Throwable rootFailure, ConfigurationInvalideException cause) {
		return new FailureAnalysis(cause.probleme(), cause.action(), cause);
	}
}
