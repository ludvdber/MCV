# Déploiement de Mars Climate Viewer

*English guide: [DEPLOYMENT.md](DEPLOYMENT.md)*

Ce guide s'adresse à l'équipe qui installera MCV sur un serveur de l'IASB. L'application est un unique fichier JAR qui contient à la fois l'interface web et l'API. Il n'y a rien d'autre à installer que Java.

## Prérequis

- Java 21 ou plus récent (`java -version` pour vérifier)
- Un accès en lecture aux dossiers de fichiers NetCDF GEM-Mars (local ou réseau)

## Obtenir le JAR

Un JAR prêt à l'emploi est publié dans les releases GitHub du projet. **Aucune compilation n'est nécessaire**, sauf si vous souhaitez modifier l'application vous-mêmes.

Pour construire depuis les sources (uniquement en cas de modification du code) :

```bash
./gradlew build -x test
```

Le JAR complet (interface incluse) se trouve ensuite dans `build/libs/`. Le build compile aussi le frontend automatiquement (Node est requis pour cette étape de build uniquement, pas sur le serveur de production).

## Installer

Copiez le JAR dans un dossier, avec le fichier de configuration à côté :

```
mcv/
├── mars-visualizer.jar
└── config/
    └── application.properties
```

Le modèle de `config/application.properties` fourni à la racine du dépôt documente chaque réglage : port HTTP, chemins des données, limites de requêtes. L'application lit ce fichier automatiquement au démarrage et il surcharge les valeurs par défaut. Vous pouvez n'y garder que les lignes que vous changez.

Lancement :

```bash
cd mcv
java -jar mars-visualizer.jar
```

L'interface est alors disponible sur `http://serveur:8080` (le port se change dans le fichier de configuration). L'état de santé se vérifie sur `http://serveur:8080/api/health`.

## Configurer les chemins des données

Deux dossiers sont attendus :

- `netcdf.mean.path` : les fichiers `.nc` moyennés (48 pas d'heure locale)
- `netcdf.individual.path` : un sous-dossier par année martienne (`34/`, `35/`, ...) contenant les fichiers à pas de temps unique

Les chemins réseau fonctionnent nativement, l'application ne fait que lire les fichiers :

| Situation | Exemple à écrire dans le fichier |
|---|---|
| Windows, disque local | `netcdf.mean.path=D:/mars-data/mean` |
| Windows, partage réseau (UNC) | `netcdf.mean.path=//srv-iasb/gem-mars/mean` |
| Linux, disque local | `netcdf.mean.path=/data/gem-mars/mean` |
| Linux, montage NFS ou CIFS | `netcdf.mean.path=/mnt/gem-mars/mean` |

Deux pièges connus :

1. **Backslashes Windows.** Dans un fichier `.properties`, `\` est un caractère d'échappement. Écrivez le chemin avec des slashes (`//serveur/partage/...`, cela fonctionne aussi pour les UNC) ou doublez chaque backslash (`\\\\serveur\\partage\\...`). Les guillemets et espaces collés en copiant un chemin sont tolérés, l'application les nettoie.
2. **Droits du compte de service.** Si MCV tourne comme service Windows sous le compte `LocalSystem`, ce compte n'a en général pas accès aux partages réseau. Utilisez un compte de service de domaine qui a le droit de lecture sur le partage, ou montez le partage côté Linux avec un fstab.

Au démarrage, l'application valide les deux dossiers et s'arrête avec un message explicite si l'un d'eux est introuvable : le message rappelle la propriété à corriger et les formats de chemins acceptés.

## Ajouter de nouvelles données

**Le catalogue est construit une seule fois, au démarrage. Un fichier déposé pendant que l'application tourne reste invisible tant qu'elle n'a pas été relancée.**

Ce n'est pas seulement une question d'affichage : un fichier `mean/` ajouté à chaud n'apparaît pas dans les menus, et une requête qui le nomme directement renvoie une erreur 404, parce que l'identifiant de dataset est résolu contre le catalogue en mémoire et non contre le disque.

### Ce qu'il faut faire selon le cas

| Ce que vous ajoutez | À faire |
|---|---|
| Un `.nc` dans `mean/` | redémarrer |
| Un nouveau sous-dossier dans `individual/` | redémarrer |
| Un `.nc` dans un sous-dossier **déjà existant** de `individual/` | supprimer `individual/.catalog-cache.json`, **puis** redémarrer |

Le troisième cas mérite une explication. Pour éviter de rescanner des milliers de fichiers à chaque démarrage, le catalogue des fichiers individuels est mémorisé dans `individual/.catalog-cache.json`. Ce cache est considéré comme périmé quand la date de modification du dossier `individual/` a changé. Or un système de fichiers ne met à jour la date d'un dossier que lorsque **ses propres entrées** changent : ajouter un fichier dans `individual/000960/` modifie la date de `000960/`, pas celle de `individual/`. Le cache se croit donc encore valide et les bornes Ls annoncées pour cette année martienne restent celles d'avant. Supprimer le fichier de cache force un scan complet.

### Procédure

```bash
# 1. Déposer les fichiers .nc dans le dossier voulu

# 2. Uniquement si des fichiers ont été ajoutés dans un sous-dossier existant :
rm /mnt/gem-mars/individual/.catalog-cache.json

# 3. Relancer l'application
sudo systemctl restart mcv          # service systemd
                                    # ou relancer le java -jar

# 4. Vérifier que les nouveaux fichiers sont bien vus
curl http://serveur:8080/api/catalog
```

Les journaux de démarrage confirment le résultat :

```text
Catalogue initialisé : 42 datasets trouvés
Catalogue INDIVIDUAL : 3 annees, 18 repertoires scannes
```

Un fichier illisible ou mal nommé n'empêche pas le démarrage : il est simplement ignoré, avec un avertissement `Impossible d'indexer le fichier '...'` dans les journaux. Si le compte s'attend à voir 42 datasets et que le journal en annonce 41, c'est là qu'il faut regarder.

### Le délai côté navigateur

Le catalogue est mis en cache une heure par les navigateurs. Un visiteur déjà venu peut donc mettre jusqu'à une heure à voir le nouveau jeu de données ; un visiteur qui arrive le voit immédiatement. Un `Ctrl+F5` force le rafraîchissement.

### Corriger un fichier existant

Les données elles-mêmes sont relues sur le disque à chaque requête, mais les navigateurs conservent les réponses **trente jours**. Si un fichier est corrigé en gardant le même nom, les personnes qui l'avaient déjà consulté continueront de voir l'ancienne version pendant tout ce temps, et un redémarrage du serveur n'y change rien.

Publier la correction sous un **nouveau nom de fichier** évite complètement le problème : l'identifiant de dataset change, donc l'adresse change, donc aucun cache ne peut répondre à sa place.

## Variables d'environnement (alternative au fichier)

Chaque réglage peut aussi être fourni par variable d'environnement, pratique pour un service systemd ou un conteneur :

```bash
NETCDF_MEAN_PATH=/mnt/gem-mars/mean \
NETCDF_INDIVIDUAL_PATH=/mnt/gem-mars/individual \
SERVER_PORT=8085 \
java -jar mars-visualizer.jar
```

L'ordre de priorité est : variables d'environnement, puis `config/application.properties`, puis les valeurs par défaut du JAR.

## Exemple de service systemd (Linux)

```ini
[Unit]
Description=Mars Climate Viewer
After=network.target remote-fs.target

[Service]
User=mcv
WorkingDirectory=/opt/mcv
ExecStart=/usr/bin/java -jar /opt/mcv/mars-visualizer.jar
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Le `WorkingDirectory` est important : c'est là que l'application cherche le dossier `config/`.

**Une unité complète et commentée est fournie dans [`deploy/mcv.service`](deploy/mcv.service)**, avec les trois variantes réseau (proxy local, proxy distant ou Cloudflare, exposition directe) et quelques options de durcissement. Le bloc Nginx correspondant est dans [`deploy/nginx-mcv.conf`](deploy/nginx-mcv.conf).

> **À ne pas oublier lors d'une mise à jour.** Le JAR ne contient aucun chemin de données réel, seulement l'exemple neutre `/data/gem-mars/...`. Les deux lignes `Environment=NETCDF_*_PATH` ne sont donc pas facultatives : sans elles le service refuse de démarrer. L'échec est propre et le journal nomme le chemin manquant, mais un JAR déposé par-dessus l'ancien sans cette section ne redonnera pas un service en marche.

## Derrière un reverse proxy

L'application honore les en-têtes `X-Forwarded-*`, mais seulement quand ils viennent d'un proxy qu'elle a de bonnes raisons de croire. C'est le rôle du couple de réglages déjà actifs :

```properties
server.forward-headers-strategy=native
server.tomcat.remoteip.internal-proxies=127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16,fc00::/7,fe80::/10
```

Cette liste par défaut couvre les cas ordinaires : un Nginx ou un Caddy sur la même machine, sur le même réseau local, ou dans le même réseau Docker. **Dans ces cas-là, il n'y a rien à configurer côté MCV.**

Il faut y toucher dans deux situations.

**Si le proxy n'est pas à une de ces adresses**, par exemple s'il est hébergé ailleurs ou joint par un réseau superposé comme Tailscale (`100.64.0.0/10`), MCV verra l'IP du proxy et non celle du visiteur : tout le monde partagera un seul quota de requêtes et se bloquera mutuellement. Ajoutez alors l'adresse du proxy :

```bash
TRUSTED_PROXIES=127.0.0.1/32,::1/128,203.0.113.10/32 java -jar mars-visualizer.jar
```

**Si l'application reste joignable en direct** en plus de l'être par le proxy, restreignez la liste à l'adresse exacte du proxy, et surtout n'écoutez que sur l'interface locale :

```bash
java -jar mars-visualizer.jar --server.address=127.0.0.1
```

### Pourquoi ce détail compte

MCV limite le nombre de requêtes par minute et par IP, parce qu'une requête coûte une lecture sur le stockage des données. Cette limite ne vaut que si l'IP est une chose que l'appelant ne choisit pas lui-même. Avec l'ancien réglage `framework`, l'en-tête était cru quel qu'en soit l'expéditeur : il suffisait d'ajouter `X-Forwarded-For: 1.2.3.4` à la main pour repartir avec un quota neuf. La valve de Tomcat, elle, n'ouvre l'en-tête qu'aux adresses listées ci-dessus.

Vous pouvez le vérifier une fois en place. Depuis une machine qui n'est pas le proxy, saturez la limite puis rejouez la même requête avec un en-tête inventé : les deux doivent répondre `429`.

```bash
for i in $(seq 1 130); do curl -s -o /dev/null -w "%{http_code} " https://mars.exemple.be/api/catalog; done
curl -s -o /dev/null -w "%{http_code}
" -H "X-Forwarded-For: 1.2.3.4" https://mars.exemple.be/api/catalog
```

### Nginx

```nginx
location / {
    proxy_pass         http://127.0.0.1:8080;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}
```

`$proxy_add_x_forwarded_for` **ajoute** la vraie IP à la suite de ce que le client avait envoyé, au lieu de le remplacer. C'est la forme la plus répandue, et elle convient : la valve lit la liste de droite à gauche et retient donc la valeur ajoutée par Nginx, pas celle du client. Si vous préférez une valeur propre, `$remote_addr` fait aussi bien.

Caddy pose ces en-têtes tout seul avec une simple directive `reverse_proxy`, il n'y a rien à écrire.

### Compression

Les réponses sont déjà compressées par MCV (HTML, CSS, JavaScript, JSON, CSV). Si vous activez aussi la compression du proxy, vérifiez qu'il ne recompresse pas ce qui l'est déjà : Nginx et Caddy sautent d'eux-mêmes les réponses portant un `Content-Encoding`.

### Cache des ressources

MCV pose lui-même ses en-têtes `Cache-Control`, et la distinction qu'il fait compte : les fichiers dont le nom porte une empreinte de contenu (`/assets/`, `/fonts/`, `/workbox-*`) sont annoncés immuables pour un an, tandis que `index.html`, `sw.js`, `registerSW.js`, `theme-init.js` et toutes les routes de l'application restent en `no-cache`.

Cette seconde moitié est celle qui compte le plus. Ce sont ces fichiers-là qui font découvrir au navigateur les nouveaux paquets après une mise en ligne : s'ils sont gardés en cache, une mise à jour n'atteint jamais quelqu'un qui a déjà visité le site. **Ne posez donc pas de règle de cache globale sur le proxy**, du genre « tout le statique pendant un mois » : elle écraserait la distinction et casserait les déploiements suivants. Laissez passer les en-têtes de MCV.

Le gain, mesuré sur la page `/slice` : 815 Ko et 37 requêtes à la première visite, et plus rien à recharger aux suivantes.
