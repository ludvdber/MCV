package com.mars.visualizer.config;

/**
 * Un refus de demarrage du au CONTENU de la configuration, pas a un defaut du
 * code.
 *
 * <p>La distinction n'est pas academique : elle decide de ce que l'exploitant
 * lit dans sa console. Une exception ordinaire remonte jusqu'a Spring, qui
 * imprime une trace de pile de quarante lignes ; la phrase qui dit quoi
 * corriger s'y trouve, mais noyee entre {@code BeanCreationException} et
 * {@code InitDestroyAnnotationBeanPostProcessor}, c'est-a-dire a l'endroit
 * exact ou personne ne la cherche. Mesure faite sur le JAR livre : pour une
 * adresse de site sans protocole, la seule phrase utile arrivait en
 * soixantieme ligne, precedee de trois « Caused by » et d'aucun message de
 * niveau ERROR.
 *
 * <p>Cette exception porte donc son texte en DEUX morceaux — ce qui ne va pas,
 * et ce qu'il faut faire — parce que c'est la forme qu'attend
 * {@link ConfigurationFailureAnalyzer} pour produire le bloc
 * « APPLICATION FAILED TO START / Description / Action » et remplacer la trace
 * de pile par lui. Le message complet reste la concatenation des deux, pour que
 * l'exception garde tout son sens hors de Spring, dans un test par exemple.
 */
public class ConfigurationInvalideException extends IllegalStateException {

	private static final long serialVersionUID = 1L;

	/** Ce qui ne va pas, avec la valeur fautive. */
	private final String probleme;

	/** Ce qu'il faut faire : propriete, variable d'environnement, formats. */
	private final String action;

	public ConfigurationInvalideException(String probleme, String action) {
		this(probleme, action, null);
	}

	public ConfigurationInvalideException(String probleme, String action, Throwable cause) {
		super(probleme + " " + action, cause);
		this.probleme = probleme;
		this.action = action;
	}

	public String probleme() {
		return probleme;
	}

	public String action() {
		return action;
	}
}
