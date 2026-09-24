# Journal des versions

Toutes les évolutions notables de Mars Climate Viewer. Les dates sont au format
ISO (AAAA-MM-JJ). English version: [CHANGELOG.md](CHANGELOG.md)

## v1.0.1 — 2026-09-24

Version de sécurité et de chaîne d'approvisionnement. Rien ne change dans ce que
l'application affiche ou calcule. Depuis la 1.0.0 : remplacer le JAR et
redémarrer ; le fichier de configuration et les fichiers de déploiement ne
changent pas.

### Sécurité

- **Tomcat 11.0.25.** Le serveur web embarqué, c'est-à-dire la partie de MCV
  exposée à internet, était en 11.0.22, qui porte trois alertes critiques
  (GHSA-9xv2-5v5q-p794, GHSA-gcx9-497g-6cp6, GHSA-h3x4-894j-xpx5). Elles
  visent les mécanismes d'authentification DIGEST et FORM, que MCV n'utilise
  pas : l'exposition réelle était faible, mais un serveur public ne doit pas
  tourner sur une version connue pour être vulnérable. Spring Boot 4.1.1 seul
  fournit la 11.0.24, d'où une version forcée en attendant.
- **Spring Boot 4.1.1**, qui apporte Jackson 3.1.5 et Log4j API 2.25.5, chacun
  corrigeant une alerte modérée (GHSA-5gvw-p9qm-jgwh, GHSA-qv9r-c865-cp47).
  Aucune n'atteignait le code de MCV : pas de `@JsonView`, et la journalisation
  passe par Logback.
- **Les dépendances Java sont désormais surveillées.** Le graphe de
  dépendances de GitHub listait 936 paquets npm et pas un seul paquet Java :
  Dependabot n'avait jamais regardé le serveur. Les alertes ci-dessus ont été
  trouvées en interrogeant la base OSV avec le classpath d'exécution résolu
  (58 dépendances, aucune vulnérable après cette version). Un workflow soumet
  désormais ce classpath à GitHub à chaque poussée.
- **maplibre-gl 6.11** (alerte XSS critique) et **fflate 0.6.11** (modérée).
  Aucune des deux n'était atteignable, et c'est mesuré plutôt que supposé :
  reconstruit avec les anciennes et les nouvelles versions, chaque fichier
  JavaScript du bundle est identique, sauf les parties notées plus bas. Plotly
  dépend de maplibre-gl, mais MCV ne charge aucune trace cartographique de
  Plotly, donc aucun code maplibre n'est livré ; fflate est livré en partie,
  dans la vue 3D, mais pas la fonction que vise l'alerte. Les deux sont mis à
  jour quand même, pour qu'aucune version vulnérable connue ne reste dans le
  lockfile. L'alternative proposée par Dependabot, Plotly 4, est une version
  majeure et reste une migration à décider.
  La mise à jour change bien deux fichiers livrés : la feuille de style de
  Plotly embarque les styles de maplibre 6 (+1,2 Ko compressé, inutilisés), et
  `bidi-js`, partagé avec les étiquettes 3D de l'accueil, passe de 1.0.3 à
  1.1.0.

### Chaîne d'approvisionnement

- **Cette version est construite par GitHub**, et non sur un poste, et porte
  une attestation de provenance signée qui couvre le JAR et les fichiers de
  déploiement. Comment vérifier un téléchargement : `SECURITY.md`.
- OpenSSF Scorecard tourne chaque semaine. Dependabot surveille désormais
  Gradle et les GitHub Actions en plus de npm, et chaque action est épinglée
  par commit.
- Une politique de sécurité (`SECURITY.md`) explique comment signaler une
  vulnérabilité en privé.

### Corrigé

- Un `./gradlew build` local après une mise à jour ne touchant que les
  dépendances pouvait embarquer l'ancien bundle frontend : le build du
  frontend ne comptait ni `package.json` ni le lockfile parmi ses entrées, et
  Gradle le jugeait à jour.
- CodeQL ne pouvait pas lire `index.html`. Son bloc JSON-LD schema.org était
  un objet JSON nu, qu'un analyseur JavaScript lit comme un bloc suivi d'une
  étiquette ; c'est maintenant un tableau d'un élément, valide en JSON-LD
  comme en JavaScript. Les moteurs de recherche lisent les mêmes données.

### Vérifié

| Couche | Résultat |
|---|---|
| Backend | 460 tests, 0 échec |
| Frontend (jsdom) | 1407 tests, 0 échec, ESLint 0 erreur |
| Bout en bout, vrai Chromium contre le JAR construit | 69 tests, 0 échec, aucune ERROR ni WARN serveur |
| Vulnérabilités connues (OSV côté Java, `npm audit` côté frontend) | 0 |

## v1.0.0 — 2026-09-15

Première version publique. Mars Climate Viewer est une interface web pour le
modèle atmosphérique GEM-Mars développé à l'Institut royal d'Aéronomie Spatiale
de Belgique (BIRA-IASB). Il lit les fichiers NetCDF de l'institut là où ils sont
déjà et les rend sous forme de cartes, de profils, de coupes et de séries
temporelles, sans dupliquer un seul octet de l'archive.

### Ce qu'il fait

- **11 pages de visualisation** : carte 2D, cycle diurne animé, série
  temporelle, profil vertical, coupe, moyenne zonale, diagramme de Hovmöller,
  profil temporel, rose des vents, différence entre deux jeux, marées thermiques.
- **Une console Explorer** qui met jusqu'à quatre vues liées côte à côte, avec
  une sonde partagée, une comparaison A/B au rideau, des transects tracés à la
  main, des statistiques de région et des particules de vent animées.
- **26 points d'entrée REST** : 16 pour les données et les catalogues, 10 pour
  les exports.
- **Exports** : 9 formats CSV, plus un export NetCDF-3 qui respecte réellement
  la convention CF-1.8 qu'il annonce.
- **Cinq langues** : anglais, français, néerlandais, allemand, espagnol. Les
  codes scientifiques, les unités et les noms de jeux ne sont volontairement
  jamais traduits.
- **Lectures partielles** : seuls la tranche, le pas de temps ou le niveau
  demandés sont lus sur le disque, donc un fichier de plusieurs gigaoctets coûte
  quelques kilooctets d'entrées-sorties par requête.
- **Un seul JAR à lancer.** Java 21 ou plus récent est la seule exigence côté
  serveur. Node sert à construire, jamais à exécuter.

### Notable dans cette version

- **L'export NetCDF dit désormais d'où il vient.** Il porte `dataset_id`, une
  ligne `history`, et des coordonnées scalaires CF pour le temps et l'altitude,
  dont les unités sont recopiées du fichier source au lieu d'être supposées.
  Avant cela, la même variable au même pas de temps et au même niveau, exportée
  depuis deux saisons martiennes opposées, produisait deux fichiers de même nom
  aux métadonnées identiques au bit près.
- **Chaque nom de fichier d'export nomme son jeu de données.** Le serveur
  envoyait pourtant un `Content-Disposition` complet, mais c'est l'application
  qui nomme le téléchargement, donc l'en-tête n'atteignait jamais le disque. La
  rose des vents était le pire cas : un `mars_windrose.csv` constant, quels que
  soient le jeu, le point et l'altitude.
- **Les exports d'image portent la même provenance que les exports de données.**
  Un PNG ou un SVG de figure est ce qui finit dans un exposé ou un article, et
  il se téléchargeait sous le nom `mars_slice_TT.png` quels que soient le jeu,
  l'heure locale et l'altitude : deux figures de saisons martiennes opposées
  entraient en collision et le navigateur nommait silencieusement la seconde
  « (1) ». Douze menus d'export reprennent maintenant le nom de base de l'export
  de données de la même vue, et un test lit les sources pour que le prochain ne
  reparte pas sans.
- **Le profil temporel refuse un jeu individuel, comme ses cinq semblables.**
  Un fichier individuel ne porte qu'un pas de temps, donc une grille
  altitude × temps se réduit à une colonne. `timeseries`, `animation`,
  `hovmoller`, `windrose` et `tides` répondaient 400 ; le profil temporel
  répondait 200 et dessinait cette colonne unique, aussi bien sur la donnée que
  sur l'export CSV. Le frontend le classait déjà parmi les vues réservées aux
  moyennes : c'est l'API qui contredisait l'interface.
- **Les messages d'erreur français n'affichent plus d'apostrophes doublées.**
  Six d'entre eux affichaient `n''est` à l'écran. Le doublement est la
  convention de `MessageFormat`, mais Spring ne fait passer un message par
  `MessageFormat` que s'il porte des arguments : un message sans argument était
  donc publié tel quel. Mesuré sur le site en ligne avant correction. Un test
  résout désormais chaque message par le bean de production et tient les deux
  sens de la règle.
- **Un curseur poussé à fond ne décale plus la page.** Le halo tactile du pouce
  (42 px) et sa bulle de valeur (jusqu'à 73 px, « 143.9 km ») débordent de la
  piste, qui affleurait le bord de sa carte : à 390 px la page défilait de 4 px
  latéralement, et la bulle d'altitude était coupée par le bord de l'écran en
  haut de la colonne. Les curseurs rentrent maintenant de 24 px, chiffre mesuré
  sur la plus large bulle de l'application. L'invariant de bout en bout qui
  aurait dû voir ça était lui-même aveugle : il ne signalait que des *éléments*
  fautifs, et un pseudo-élément n'a pas de rectangle. Il annonce désormais le
  débordement, qu'il sache ou non l'attribuer.
- **Les symboles scientifiques survivent à l'export.** `Dust mixing ratio
  (0.1 µm)` devenait `(0.1 ?m)` sur les trois variables de poussière. Le texte
  des attributs NetCDF-3 doit rester en ASCII, mais « um » conserve le sens là
  où « ? » le détruit. Les accents sont maintenant retirés par décomposition
  Unicode plutôt que remplacés.
- **Une erreur de configuration est enfin lisible.** Les refus au démarrage
  s'affichent en `APPLICATION FAILED TO START`, avec un bloc Description et un
  bloc Action séparés, en français et en anglais, sans trace de pile : 34 lignes
  au lieu de 53, dont 40 étaient des appels Java. La trace reste à une option
  près (`--logging.level.org.springframework.boot.diagnostics=DEBUG`). Quand une
  variable d'environnement masque le fichier de configuration, le refus le dit
  et affiche sa valeur, parce que Spring la classe au-dessus du fichier.
- **Un modèle de configuration est déposé à côté du JAR au premier démarrage**,
  et son chemin absolu est annoncé, pour que le message d'erreur ne désigne
  jamais un fichier inexistant.
- **La compilation fixe l'encodage des sources en UTF-8**, donc les messages
  accentués de la console ne dépendent plus de la langue de la machine qui a
  construit le JAR.
- **Le JAR n'embarque plus trois builds de JavaScript mort.** La tâche qui
  empaquette le frontend copiait sans jamais effacer, et Vite nomme chaque
  fragment d'après son empreinte : rien n'était donc jamais remplacé. 163
  fichiers livrés pour les 55 que produit un build, soit 3 Mo d'orphelins. Une
  page retirée du routeur restait même joignable à son ancienne adresse de
  fragment. Le JAR pèse 1 Mo de moins.
- **Le vent animé est plafonné à 60 images par seconde, et sa vitesse ne dépend
  plus de votre écran.** La boucle suivait le taux de rafraîchissement du moniteur
  sans aucune borne : mesuré sur la console Explorer avec quatre vues en grille,
  181 images par seconde et 1,39 million de pixels repeints par image, soit trois
  fois le travail d'un écran 60 Hz pour une image identique. La constante
  d'advection était exprimée par IMAGE, si bien que le vent défilait aussi trois
  fois plus vite là que sur un écran 60 Hz. Tout ce qui bouge est désormais
  rapporté au temps écoulé, et une carte sortie de l'écran cesse de s'animer au
  lieu de tourner pour personne.
- **Chaque image exportée nomme désormais son jeu de données.** Le correctif
  qui avait donné aux exports CSV et NetCDF leur jeu, leur heure et leur
  altitude n'avait jamais atteint les exports PNG et SVG : une carte 2D se
  téléchargeait `mars_slice_TT.png` quels que soient le jeu, l'heure locale
  et l'altitude, et la rose des vents sous la constante `mars_windrose`. Deux
  figures de saisons martiennes opposées entraient donc en collision, le
  navigateur nommant la seconde « (1) ». Une figure exportée finit dans un
  article ou un exposé : elle porte maintenant le même nom de base que
  l'export de données de la même vue.
- **Le rideau A/B laisse enfin choisir ce qu'il compare.** Le volet B était
  toujours la première autre coupe comparable : l'action qui aurait pu en changer
  existait dans la machine à états et n'était émise de nulle part. Son nom
  n'apparaissait que dans l'infobulle du bouton, qu'un écran tactile ne montre
  jamais et qui devient « Quitter » dès l'ouverture du rideau. Les deux volets
  sont maintenant nommés en clair avant d'ouvrir : A est la vue active, B se
  choisit dans une liste.
- **La moyenne zonale ne s'effondre plus quand on change un réglage après
  l'avoir affichée.** Choisir un autre jeu ou une autre variable une fois la
  vue à l'écran emportait toute la route dans son filet de sécurité, et
  « Réessayer » semblait réparer seulement parce que le composant était remonté
  à neuf. La cause est une trace contour de Plotly dont les niveaux sont
  calculés automatiquement : un redessin qui saute le recalcul les perd, et le
  code des contours lit alors une liste de niveaux vide. Les niveaux sont
  désormais donnés explicitement, selon la règle même de Plotly, si bien que les
  figures sont inchangées, vérifié niveau par niveau.
- **L'historique nomme enfin les jeux comme le sélecteur.** Chaque entrée
  affichait le nom de fichier brut de la pipeline,
  `hl-b274_032094p_ls000_0000_MY35_sol668to739_71days_mean_crossdir`, au lieu de
  « MY35 - Ls 0° à 30° ». Le motif censé le rendre lisible exigeait que `MY`
  précède `Ls`, alors que la pipeline écrit l'inverse : il ne mordait donc sur
  aucun jeu réel et le repli sur l'identifiant brut se déclenchait à chaque fois.

- **Un visiteur qui part avant la fin du chargement n'est plus journalisé comme
  une panne du serveur.** Fermer un onglet, changer de page ou annuler une
  requête coupe la connexion pendant que la réponse s'écrit. Chacun de ces
  gestes produisait une trace ERROR de 77 lignes affirmant que le serveur avait
  échoué, et sur les routes de la SPA un second WARN par-dessus, parce que le
  gestionnaire d'erreur tentait ensuite d'écrire un corps JSON dans une réponse
  déjà partie. Les déconnexions sont désormais reconnues à la chaîne des causes
  plutôt qu'au type levé, ce qu'imposaient les deux emballages mesurés ici, et
  plus rien n'est écrit une fois la réponse partie. Mesuré sur le JAR livré en
  forçant la panne : trois entrées ERROR avant, aucune après, les vraies pannes
  du serveur restant rapportées en entier.

- **Le journal du serveur rapporte désormais ce que le serveur a fait, pas ce
  que les visiteurs ont mal fait.** Un en-tête `Accept` mal formé faisait
  répondre **500** et annoncer une panne, tandis qu'un `Accept` que l'API ne sert
  pas produisait une ERROR puis un second avertissement affirmant que le
  gestionnaire d'erreur lui-même avait échoué : c'est la même exception de Spring
  empruntée par deux chemins, et les deux répondent maintenant 406, sans corps et
  sans bruit. Le détail des lectures NetCDF passe en DEBUG, ce qui supprime au
  passage un accès disque fait à chaque lecture dans le seul but de le
  journaliser. Mesuré sur le JAR livré : une visite ordinaire écrit 7 lignes au
  lieu de 10, et une passe complète de trafic hostile (téléchargements coupés,
  balayages de robots, méthodes interdites, paramètres hors bornes ou mal
  formés) n'écrit **aucune ERROR**, seulement des refus d'une ligne. Les deux
  niveaux se rétablissent par une ligne commentée du `application.properties`
  livré.

### Vérifié

Mesuré contre les données réelles de l'institut, pas contre des fixtures :

| Couche | Résultat |
|---|---|
| Backend | 460 tests, 0 échec, 96,3 % de couverture d'instructions, 87,4 % de branches |
| Frontend (jsdom) | 1407 tests, 0 échec, 90,6 % d'instructions, 93,9 % de lignes |
| Bout en bout (Chromium) | 69 tests, 0 échec contre ce JAR |
| Audit des exports | 560 contrôles sur 23 cas CSV et 10 cas NetCDF |

Chaque valeur exportée a été comparée de trois façons : le fichier livré, le
JSON qu'affiche l'interface, et le fichier GEM-Mars source lu indépendamment
avec la bibliothèque C netCDF4. L'export NetCDF a en plus été validé champ par
champ contre la spécification binaire NetCDF-3.

### Comportement connu

- La température de surface (`MTSF`) arrive de la pipeline GEM-Mars actuelle
  avec un décalage de +273,15 K qui rend les valeurs physiquement impossibles
  sur Mars. L'application le détecte, le compense, et journalise un
  avertissement à chaque fois. C'est une correction temporaire en attendant un
  correctif de pipeline, et elle s'applique aussi aux exports.
- La suite de bout en bout ne fait pas partie de l'intégration continue, faute
  de données NetCDF sur le runner. Jouez-la contre un déploiement avant de
  publier : `MCV_E2E_URL=https://… npm run test:e2e`.

### Installation

Téléchargez `mars-visualizer.jar`, posez-le dans un dossier, et lancez
`java -jar mars-visualizer.jar`. Au premier démarrage il écrit
`config/application.properties` à côté de lui et vous dit où ; renseignez-y les
deux chemins NetCDF et relancez. Guide complet :
[DEPLOYMENT.fr.md](DEPLOYMENT.fr.md).

Vérifiez votre téléchargement avec `SHA256SUMS.txt` :
`sha256sum -c SHA256SUMS.txt`.
