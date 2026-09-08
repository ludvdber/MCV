package com.mars.visualizer.exception;

import java.io.File;

/**
 * Assainit les arguments des messages d'erreur avant qu'ils n'atteignent le
 * client.
 *
 * <p>Les trois exceptions applicatives portent une cle i18n et des arguments,
 * que {@code GlobalExceptionHandler} resout en un texte renvoye <b>tel quel</b>
 * dans le corps de la reponse HTTP. Ces arguments viennent de deux sources qui
 * ne doivent ni l'une ni l'autre voyager sans controle :
 *
 * <ul>
 *   <li><b>Un chemin de fichier du serveur.</b> Un jeu INDIVIDUAL est resolu en
 *       chemin ABSOLU ({@code DatasetResolver.resolveIndividualFile} appelle
 *       {@code toAbsolutePath}), et {@code NetCDFReaderService.readFile}
 *       transmet ce chemin comme argument quand la lecture echoue. Un fichier
 *       tronque, un disque reseau qui bronche, et le corps du 500 publiait
 *       l'arborescence complete de la machine a un visiteur anonyme. Seul le
 *       nom du fichier a une valeur pour l'utilisateur ; le reste ne renseigne
 *       que celui qui cherche a cartographier le serveur.</li>
 *   <li><b>Une valeur envoyee par le client.</b> {@code error.dataset.not.found}
 *       renvoie l'identifiant demande, sans borne : 5 000 caracteres envoyes,
 *       5 100 renvoyes. Le corps reste du JSON echappe servi en
 *       {@code application/json} avec {@code nosniff}, donc il n'y a pas de
 *       script a executer, mais une API qui repete l'entree sans la borner
 *       n'apporte rien a l'utilisateur (un identifiant reel fait vingt
 *       caracteres) et transforme chaque erreur en miroir.</li>
 * </ul>
 *
 * <p>Le traitement est place ici, dans le constructeur des exceptions, et non
 * sur le site d'appel qui a rate le premier : tout argument de message est
 * concerne, y compris ceux qu'on ajoutera plus tard.
 */
final class MessageArgs {

	/**
	 * Longueur maximale d'un argument textuel renvoye au client. Les valeurs
	 * legitimes (un identifiant de jeu, un code de variable, un nom de fichier
	 * GEM-Mars) tiennent largement en dessous.
	 */
	private static final int LONGUEUR_MAX = 80;

	private MessageArgs() {
	}

	/**
	 * Rend une copie des arguments, chaque chaine reduite a son nom de fichier
	 * si elle ressemble a un chemin, puis tronquee.
	 *
	 * @param args arguments bruts (peut etre {@code null})
	 * @return arguments assainis, jamais partages avec l'appelant
	 */
	static Object[] assainir(Object[] args) {
		if (args == null || args.length == 0) {
			return args;
		}
		Object[] propres = new Object[args.length];
		for (int i = 0; i < args.length; i++) {
			propres[i] = args[i] instanceof String texte ? assainirTexte(texte) : args[i];
		}
		return propres;
	}

	private static String assainirTexte(String texte) {
		String reduit = sansArborescence(texte);
		return reduit.length() <= LONGUEUR_MAX
				? reduit
				: reduit.substring(0, LONGUEUR_MAX) + "...";
	}

	/**
	 * Ne garde que le dernier segment d'un chemin.
	 *
	 * <p>Les deux separateurs sont testes, pas seulement celui de la plateforme
	 * courante : le serveur de production tourne sous Linux et le poste de
	 * developpement sous Windows, et un chemin peut aussi venir d'un fichier de
	 * configuration ecrit sur l'autre systeme. Les valeurs qui ne contiennent
	 * aucun separateur — un code de variable, un type de coupe, un intervalle
	 * d'indices — ressortent inchangees.
	 */
	private static String sansArborescence(String texte) {
		int coupure = Math.max(texte.lastIndexOf('/'), texte.lastIndexOf(File.separatorChar));
		coupure = Math.max(coupure, texte.lastIndexOf('\\'));
		if (coupure < 0 || coupure == texte.length() - 1) {
			return texte;
		}
		return texte.substring(coupure + 1);
	}
}
