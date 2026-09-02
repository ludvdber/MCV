# Deploying Mars Climate Viewer

*Guide en français : [DEPLOYMENT.fr.md](DEPLOYMENT.fr.md)*

This guide is for the team installing MCV on a BIRA-IASB server. The application ships as a single JAR file that contains both the web interface and the API. Nothing needs to be installed besides Java.

## Prerequisites

- Java 21 or newer (check with `java -version`)
- Read access to the GEM-Mars NetCDF data folders (local or network)

## Getting the JAR

A ready-to-run JAR is published on the GitHub releases page of the project. **You do not need to compile anything** unless you want to modify the application yourself.

To build from source (only if you modify the code):

```bash
./gradlew build -x test
```

The full JAR (interface included) then appears in `build/libs/`. The build compiles the frontend automatically; Node.js is only needed for this build step, never on the production server.

## Installing

Copy the JAR into a folder, with the configuration file next to it:

```
mcv/
├── mars-visualizer.jar
└── config/
    └── application.properties
```

The `config/application.properties` template provided at the root of the repository documents every setting: HTTP port, data paths, request limits. The application reads this file automatically at startup and it overrides the defaults embedded in the JAR. You only need to keep the lines you change.

Run it:

```bash
cd mcv
java -jar mars-visualizer.jar
```

The interface is then available at `http://server:8080` (the port is configurable). Health check: `http://server:8080/api/health`.

## Configuring the data paths

Two folders are expected:

- `netcdf.mean.path`: the averaged `.nc` files (48 local-time steps)
- `netcdf.individual.path`: one subfolder per Martian year (`34/`, `35/`, ...) containing single-timestep files

Network paths work natively; the application only ever reads the files:

| Situation | Example to write in the file |
|---|---|
| Windows, local disk | `netcdf.mean.path=D:/mars-data/mean` |
| Windows, network share (UNC) | `netcdf.mean.path=//srv-iasb/gem-mars/mean` |
| Linux, local disk | `netcdf.mean.path=/data/gem-mars/mean` |
| Linux, NFS or CIFS mount | `netcdf.mean.path=/mnt/gem-mars/mean` |

Two known pitfalls:

1. **Windows backslashes.** In a `.properties` file, `\` is an escape character. Write the path with forward slashes (`//server/share/...` also works for UNC paths) or double every backslash (`\\\\server\\share\\...`). Quotes and stray spaces from copy-pasting a path are tolerated; the application cleans them up.
2. **Service account permissions.** If MCV runs as a Windows service under the `LocalSystem` account, that account generally cannot access network shares. Use a domain service account with read access to the share, or mount the share on Linux via fstab.

At startup the application validates both folders and stops with an explicit message if one of them cannot be found; the message names the property to fix and the accepted path formats.

## Adding new data

**The catalog is built once, at startup. A file dropped in while the application is running stays invisible until it is restarted.**

This is not only about the menus: a `mean/` file added at runtime does not show up in the dropdowns, and a request naming it directly returns a 404, because dataset ids are resolved against the in-memory catalog rather than against the disk.

### What to do, case by case

| What you add | What to do |
|---|---|
| A `.nc` file in `mean/` | restart |
| A new subfolder in `individual/` | restart |
| A `.nc` file inside an **existing** subfolder of `individual/` | delete `individual/.catalog-cache.json`, **then** restart |

The third case deserves an explanation. To avoid rescanning thousands of files on every start, the individual-file catalog is stored in `individual/.catalog-cache.json`. That cache is treated as stale when the modification time of the `individual/` folder changes. But a filesystem only updates a folder's timestamp when **its own entries** change: adding a file inside `individual/000960/` updates the timestamp of `000960/`, not of `individual/`. The cache therefore still believes it is valid, and the Ls bounds advertised for that Martian year stay as they were. Deleting the cache file forces a full scan.

### Procedure

```bash
# 1. Drop the .nc files into the right folder

# 2. Only if files were added inside an existing subfolder:
rm /mnt/gem-mars/individual/.catalog-cache.json

# 3. Restart the application
sudo systemctl restart mcv          # systemd service
                                    # or restart the java -jar

# 4. Check that the new files are seen
curl http://server:8080/api/catalog
```

The startup log confirms the outcome:

```text
Catalogue initialisé : 42 datasets trouvés
Catalogue INDIVIDUAL : 3 annees, 18 repertoires scannes
```

An unreadable or badly named file does not prevent startup: it is simply skipped, with an `Impossible d'indexer le fichier '...'` warning in the log. If you expect 42 datasets and the log announces 41, that warning is where to look.

### The browser-side delay

Browsers cache the catalog for one hour. A returning visitor may therefore take up to an hour to see the new dataset; a first-time visitor sees it immediately. `Ctrl+F5` forces a refresh.

### Correcting an existing file

The data itself is re-read from disk on every request, but browsers keep the responses for **thirty days**. If a file is corrected under the same name, anyone who already viewed it will keep seeing the old version for that whole period, and restarting the server changes nothing.

Publishing the correction under a **new filename** avoids the problem entirely: the dataset id changes, so the URL changes, so no cache can answer in its place.

## Environment variables (alternative to the file)

Every setting can also be supplied as an environment variable, which is convenient for a systemd service or a container:

```bash
NETCDF_MEAN_PATH=/mnt/gem-mars/mean \
NETCDF_INDIVIDUAL_PATH=/mnt/gem-mars/individual \
SERVER_PORT=8085 \
java -jar mars-visualizer.jar
```

Precedence order: environment variables, then `config/application.properties`, then the defaults inside the JAR.

## Example systemd service (Linux)

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

The `WorkingDirectory` matters: it is where the application looks for the `config/` folder.

## Behind a reverse proxy

The application honours `X-Forwarded-*` headers, but only when they come from a proxy it has good reason to believe. That is the job of the two settings already enabled:

```properties
server.forward-headers-strategy=native
server.tomcat.remoteip.internal-proxies=127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16,fc00::/7,fe80::/10
```

That default list covers the ordinary cases: an Nginx or Caddy on the same machine, on the same LAN, or on the same Docker network. **In those cases there is nothing to configure on the MCV side.**

Two situations call for a change.

**If the proxy is not at one of those addresses**, for instance hosted elsewhere or reached over an overlay network such as Tailscale (`100.64.0.0/10`), MCV sees the proxy's IP instead of the visitor's: everyone then shares a single request quota and blocks one another. Add the proxy's address:

```bash
TRUSTED_PROXIES=127.0.0.1/32,::1/128,203.0.113.10/32 java -jar mars-visualizer.jar
```

**If the application stays reachable directly** as well as through the proxy, narrow the list to the proxy's exact address, and above all listen on the loopback interface only:

```bash
java -jar mars-visualizer.jar --server.address=127.0.0.1
```

### Why this detail matters

MCV limits requests per minute per IP, because every request costs a read on the data storage. That limit is only worth something if the IP is not something the caller picks. Under the former `framework` setting the header was believed whoever sent it: adding `X-Forwarded-For: 1.2.3.4` by hand was enough to walk away with a fresh quota. Tomcat's valve only opens the header to the addresses listed above.

You can check this once deployed. From a machine that is not the proxy, saturate the limit then replay the same request with a made-up header: both must answer `429`.

```bash
for i in $(seq 1 130); do curl -s -o /dev/null -w "%{http_code} " https://mars.example.org/api/catalog; done
curl -s -o /dev/null -w "%{http_code}
" -H "X-Forwarded-For: 1.2.3.4" https://mars.example.org/api/catalog
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

`$proxy_add_x_forwarded_for` **appends** the real IP after whatever the client sent, rather than replacing it. That is the most widespread form and it is fine here: the valve reads the list right to left, so it keeps the value Nginx added, not the client's. If you prefer a clean value, `$remote_addr` does just as well.

Caddy sets these headers on its own with a plain `reverse_proxy` directive, nothing to write.

### Compression

Responses are already compressed by MCV (HTML, CSS, JavaScript, JSON, CSV). If you also enable compression on the proxy, make sure it does not recompress what already is: Nginx and Caddy skip responses that carry a `Content-Encoding` of their own.

### Resource caching

MCV sets its own `Cache-Control` headers, and the distinction it makes matters: files whose name carries a content hash (`/assets/`, `/fonts/`, `/workbox-*`) are declared immutable for a year, while `index.html`, `sw.js`, `registerSW.js`, `theme-init.js` and every application route stay on `no-cache`.

That second half is the one that matters most. Those files are how a browser discovers the new bundles after a deployment: cache them and an update never reaches anyone who has already visited the site. **So do not add a blanket caching rule on the proxy**, along the lines of "all static files for a month": it would flatten the distinction and break every later deployment. Let MCV's headers through.

The gain, measured on the `/slice` page: 815 KB across 37 requests on a first visit, and nothing left to download on the next ones.
