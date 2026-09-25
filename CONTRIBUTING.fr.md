# Contribuer à Mars Climate Viewer

*English version: [CONTRIBUTING.md](CONTRIBUTING.md)*

Merci de prendre ce temps. Les signalements de bug, les questions, les
corrections de la documentation et les modifications du code sont tous les
bienvenus.

## Signaler un bug ou demander une fonctionnalité

Ouvrez une issue sur GitHub :
[github.com/ludvdber/MCV/issues](https://github.com/ludvdber/MCV/issues).
Un signalement utile dit :

- ce que vous avez fait (la page, le jeu de données, la variable, ou un
  permalien, qui contient tout cela) ;
- ce que vous attendiez, et ce qui s'est passé à la place ;
- votre navigateur, ou les lignes du journal du serveur si le problème vient du
  serveur.

Les issues sont publiques. **Ne signalez pas une vulnérabilité de sécurité dans
une issue** : suivez [SECURITY.md](SECURITY.md) pour la signaler en privé.

## Proposer une modification

1. Forkez le dépôt et créez une branche à partir de `master`.
2. Faites votre modification, avec ses tests (voir plus bas).
3. Lancez les vérifications en local :

   ```bash
   ./gradlew build                  # tests backend + JAR
   cd frontend
   npm run lint
   npm run test                     # suite Vitest
   ```

4. Ouvrez une pull request vers `master`. Expliquez ce que fait la
   modification et pourquoi ; une capture d'écran aide pour tout ce qui se voit.

Chaque pull request lance l'intégration continue (suites backend et frontend),
l'analyse statique CodeQL et une revue des dépendances. Une pull request n'est
fusionnée que si tout passe. `master` est protégée : elle ne peut être ni
supprimée ni écrasée par un push forcé, et un commit n'y est accepté qu'une fois
analysé par CodeQL.

Comment construire et lancer le projet, et ce que prouve chaque suite de tests :
[docs/DEVELOPMENT.fr.md](docs/DEVELOPMENT.fr.md).

## Exigences pour une contribution

### Les tests font partie de la modification

**Une nouvelle fonctionnalité arrive avec des tests automatisés, et une
correction de bug avec un test qui échoue sans la correction.** C'est la
politique de tests du projet, et elle s'applique à chaque pull request :

- backend : JUnit 5 dans `src/test/java` (`./gradlew test`) ;
- logique du frontend : Vitest dans `frontend/src/**/*.test.js(x)`
  (`npm run test`) ;
- tout ce qui se voit (mise en page, rendu, chevauchement, clavier) : un
  invariant dans la suite de bout en bout, `frontend/e2e/` (`npm run test:e2e`,
  qui demande une application servie avec des données).

Avant de faire confiance à un nouveau test, vérifiez qu'il échoue sur le code
qu'il doit protéger. Un test qui passe avant comme après une correction ne
prouve rien à son sujet.

### Conventions du code

- **Tout texte visible est traduit**, par `t('clé')` côté frontend et
  `MessageSource` côté backend, dans les cinq langues (`en`, `fr`, `nl`, `de`,
  `es`), avec le même ensemble de clés. Les codes scientifiques (`TT`, `UU`),
  les unités (`K`, `Pa`) et les noms de jeux de données ne sont jamais traduits.
- **Les sorties lues par une machine sont formatées avec `Locale.ROOT`**
  (en-têtes CSV, noms de fichiers, attributs NetCDF). La langue du serveur ne
  doit jamais changer un fichier qu'un autre programme lit.
- **Les noms des fichiers GEM-Mars sont fixés par la pipeline en amont** et ne
  doivent pas être renommés : les identifiants de jeu, les années martiennes et
  les plages de Ls en sont déduits.
- **Les fichiers NetCDF sont lus partiellement** : seule la tranche, l'heure ou
  le niveau demandé est lu sur le disque.
- Suivez le style du code autour de votre modification. ESLint ne doit signaler
  aucune erreur.

### Licence

En contribuant, vous acceptez que votre contribution soit publiée sous la
[licence MIT](LICENSE) du projet.

## Code de conduite

Soyez respectueux et constructif. On discute du travail, pas de la personne.
