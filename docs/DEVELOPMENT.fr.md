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
| `./gradlew test` | Suite JUnit 5 (448 tests) + rapport de couverture JaCoCo |
| `./gradlew buildFrontend` | Build de production du frontend uniquement |

Rapport de couverture : `build/reports/jacoco/test/html/index.html`. Actuellement 96,2 % des instructions, 87,6 % des branches et 96,1 % des lignes.

### npm (`frontend/`)

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement Vite sur :5173 avec rechargement à chaud |
| `npm run build` | Build de production dans `frontend/dist/` |
| `npm run preview` | Sert le build de production en local |
| `npm run test` | Suite Vitest (1395 tests, jsdom) |
| `npm run test:e2e` | Suite de bout en bout (66 tests) dans un vrai Chromium |
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
