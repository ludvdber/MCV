# Journal des versions

Toutes les évolutions notables de Mars Climate Viewer. Les dates sont au format
ISO (AAAA-MM-JJ). English version: [CHANGELOG.md](CHANGELOG.md)

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
- **Le rideau A/B laisse enfin choisir ce qu'il compare.** Le volet B était
  toujours la première autre coupe comparable : l'action qui aurait pu en changer
  existait dans la machine à états et n'était émise de nulle part. Son nom
  n'apparaissait que dans l'infobulle du bouton, qu'un écran tactile ne montre
  jamais et qui devient « Quitter » dès l'ouverture du rideau. Les deux volets
  sont maintenant nommés en clair avant d'ouvrir : A est la vue active, B se
  choisit dans une liste.

### Vérifié

Mesuré contre les données réelles de l'institut, pas contre des fixtures :

| Couche | Résultat |
|---|---|
| Backend | 448 tests, 0 échec, 96,0 % de couverture d'instructions, 87,4 % de branches |
| Frontend (jsdom) | 1391 tests, 0 échec, 90,6 % d'instructions, 93,9 % de lignes |
| Bout en bout (Chromium) | 66 tests, 0 échec contre ce JAR |
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
