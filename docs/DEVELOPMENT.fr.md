# Développement

*English version: [DEVELOPMENT.md](DEVELOPMENT.md)*

Construction, tests et intégration continue. Le [README](../README.fr.md) ne
garde que les commandes ; les chiffres et le raisonnement derrière les deux
suites de tests vivent ici, où ils peuvent bouger sans réécrire la page
d'accueil.

---

## Commandes de build et de test

### Gradle (racine du dépôt)

| Commande | Effet |
|---|---|
| `./gradlew bootRun` | Démarre le backend sur :8080 (recompile le frontend au préalable) |
| `./gradlew build` | Build complet : frontend, compilation, tests, JAR dans `build/libs/` |
| `./gradlew build -x test` | Idem sans la suite de tests |
| `./gradlew bootJar` | JAR uniquement, sans tests |
| `./gradlew test` | Suite JUnit 5 (461 tests) + rapport de couverture JaCoCo |
| `./gradlew buildFrontend` | Build de production du frontend uniquement |

Rapport de couverture : `build/reports/jacoco/test/html/index.html`. Actuellement 96,1 % des instructions, 87,5 % des branches et 95,8 % des lignes.

### npm (`frontend/`)

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement Vite sur :5173 avec rechargement à chaud |
| `npm run build` | Build de production dans `frontend/dist/` |
| `npm run preview` | Sert le build de production en local |
| `npm run test` | Suite Vitest (1418 tests, jsdom) |
| `npm run test:e2e` | Suite de bout en bout (69 tests) dans un vrai Chromium |
| `npx vitest run --coverage` | Idem, avec le rapport de couverture dans `frontend/coverage/` |
| `npm run lint` | Vérification ESLint |

Les deux suites ne prouvent pas la même chose. Celle de Vitest tourne dans
jsdom, qui n'a pas de moteur de mise en page : aucune boîte n'a de position ni
de taille, et `clip-path` n'existe pas. Elle prouve la logique, jamais
l'affichage. La suite de bout en bout ouvre un vrai navigateur sur
l'application servie et vérifie sept invariants : aucun conteneur de graphe
vide, aucun élément superposé à un autre de même nature, aucun recouvrement
entre deux familles comme un titre et une barre d'outils, des statistiques lues
à l'écran arithmétiquement possibles, aucun débordement horizontal à 390, 820 et
1600 pixels, aucune cible tactile sous 24 par 24 pixels, et aucun curseur sans
nom accessible ni valeur lisible. Elle couvre le
rideau A/B, les onze pages de visualisation, les grilles et les outils de la
console, l'affichage sur téléphone, et les parcours réels : clavier, permalien,
export, cinq langues. Trois défauts ont vécu en production sous une suite jsdom
verte parce qu'ils étaient tous les trois géométriques : un conteneur de graphe
à pleine taille sans rien de dessiné dedans, deux barres de statistiques aux
mêmes coordonnées tranchées par le rideau, et deux titres centrés qui se
recouvraient à 94 %.

```bash
npm run test:e2e                                          # cible localhost:5173
MCV_E2E_URL=https://mars.exemple.be npm run test:e2e      # cible un déploiement
```

`MCV_E2E_API` rebranche `/api` vers un autre serveur, ce qui permet d'éprouver
une interface locale contre un backend qui, lui, possède les données.

La couverture du frontend est actuellement de 90,5 % des instructions et 93,8 %
des lignes. La configuration Vitest active `coverage.all` : un fichier qu'aucun
test n'importe entre quand même au dénominateur. Retirer ce réglage gonflerait
le chiffre sans qu'une seule ligne de test soit écrite.

---

## Intégration continue

`.github/workflows/ci.yml` s'exécute à chaque push et à chaque pull request, en
deux tâches parallèles :

| Tâche | Fait |
|---|---|
| Backend | Java 21, `./gradlew build jacocoTestReport` (construit le frontend, joue la suite JUnit, produit le JAR) |
| Frontend | `npm ci`, ESLint, Vitest avec couverture |

Les rapports de test, le rapport de couverture et le JAR produit sont conservés
comme artefacts pendant 14 jours : un échec se lit sans avoir à reproduire le
build en local.

Le workflow rend `gradlew` exécutable avant de l'appeler. Le dépôt est développé
sous Windows, qui n'a pas de bit d'exécution : le fichier est enregistré en
`100644` dans l'index et `./gradlew` échouerait en *Permission denied* sur un
exécuteur Linux. Pour corriger cela durablement dans le dépôt :

```bash
git update-index --chmod=+x gradlew
```

## Workflows de sécurité

| Workflow | Quand | Fait |
|---|---|---|
| `dependency-submission.yml` | chaque poussée sur `master` | Soumet à GitHub le graphe des dépendances Gradle résolues. Sans lui, le graphe ne voit que npm et Dependabot n'examine jamais la partie Java |
| `scorecard.yml` | chaque semaine et à chaque poussée sur `master` | OpenSSF Scorecard ; résultats dans Security → Code scanning, note dans le badge du README |
| CodeQL (configuration par défaut, réglages du dépôt) | poussée et pull request | Analyse statique du Java, du JavaScript et des workflows |

`.github/dependabot.yml` surveille npm, Gradle et les GitHub Actions chaque
semaine. Les mises à jour mineures et correctives arrivent groupées ; une
version majeure arrive seule, parce qu'elle se décide (Plotly 3 vers 4 change
un comportement que la suite jsdom ne voit pas). Chaque action est épinglée par
l'empreinte de son commit, la version en commentaire.

## Publier une release

Les releases sont construites par GitHub Actions, pas sur un poste, pour que
chacune porte une attestation de provenance signée. Tout se fait sur le site :

1. Monter `version` dans `build.gradle` et `frontend/package.json` (les deux
   doivent concorder) et ajouter une section `## vX.Y.Z` au `CHANGELOG.md` :
   c'est elle qui devient le texte de la release.
   `python .github/scripts/version.py` vérifie les trois en local.
2. Commiter et pousser sur `master`.
3. **Actions → release → Run workflow**, case décochée : build d'essai. Les
   cinq fichiers sont joints au run pendant sept jours.
4. Même chose, case **cochée** : build, attestation, et release en
   **brouillon**.
5. Relire le brouillon, puis **Publish release**. Le tag est créé à ce
   moment-là, sur le commit construit.

Pour vérifier un fichier téléchargé : `gh attestation verify mars-visualizer.jar --repo ludvdber/MCV`.
