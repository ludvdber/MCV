# Mars Climate Viewer

*Version française : [README.fr.md](README.fr.md)*

Web application for exploring GEM-Mars atmospheric simulations (Martian climate model, BIRA-IASB) stored as NetCDF files. Eleven visualization types — maps, vertical profiles, cross-sections, diurnal animations, Hovmöller diagrams, thermal tides — served from a browser, with no client-side install.

Files are **read partially**: for every request the server reads only the requested slice/timestep/level from disk (`variable.read(origin, shape)`), never the whole file. Multi-terabyte datasets stay on the server.

![2D Slice view: temperature map at 41 km altitude](docs/images/vue2d.en.png)

| Component | Stack |
|---|---|
| Backend | Spring Boot 4.1, Java 21, NetCDF-Java (cdm-core 5.9), Gradle 9 |
| Frontend | React 19, Vite 8, Plotly.js, Three.js, MUI 9, i18next |

---

## Requirements

| Requirement | Version | Needed for |
|---|---|---|
| **Java** | 21 or newer | running the application |
| **Node.js** | 20 or newer | building the frontend only — never required on the production server |
| **GEM-Mars data** | `.nc` files | see [Configuration](#configuration) |

---

## Install

```bash
git clone <repository-url>
cd mars-visualizer
cd frontend && npm install && cd ..
```

`./gradlew` requires no local Gradle install (wrapper included).

---

## Configuration

The application needs two data folders. Set them **before the first start**, otherwise startup fails with an explicit error naming the missing path.

| Property | Environment variable | Default | Description |
|---|---|---|---|
| `netcdf.mean.path` | `NETCDF_MEAN_PATH` | `/data/gem-mars/mean` | Folder with the averaged `.nc` files (48 local-time steps). The default is a neutral placeholder: startup fails with an explicit message until it is set |
| `netcdf.individual.path` | `NETCDF_INDIVIDUAL_PATH` | `/data/gem-mars/individual` | Folder with one subfolder per Martian year (`34/`, `35/`, …) |
| `netcdf.individual.my_base` | — | `34` | First Martian year present in that folder; later years are detected automatically |
| `server.port` | `SERVER_PORT` | `8080` | HTTP port serving both the API and the interface |
| `ratelimit.requests-per-minute` | — | `120` | Per-IP request limit |
| `ratelimit.export-per-minute` | — | `20` | Per-IP export limit (CSV/NetCDF) |
| `cors.allowed-origin` | — | `http://localhost:5173` | Only used when the frontend is served separately (dev mode) |
| `server.tomcat.remoteip.internal-proxies` | `TRUSTED_PROXIES` | loopback + private ranges | Proxies whose `X-Forwarded-For` is believed. Leave as is for a proxy on the same host or LAN; see [DEPLOYMENT.md](DEPLOYMENT.md#behind-a-reverse-proxy) |

**Network shares are supported.** In a `.properties` file `\` is an escape character, so either double every backslash or use forward slashes — both forms work for UNC paths:

```properties
netcdf.mean.path=//srv-iasb/gem-mars/mean          # UNC, forward slashes (simplest)
netcdf.mean.path=\\\\srv-iasb\\gem-mars\\mean      # UNC, escaped backslashes
netcdf.mean.path=/mnt/gem-mars/mean                # Linux NFS/CIFS mount
```

An unreachable path is detected at startup within a few seconds and the application refuses to start rather than serving an empty catalog. A file that disappears while running returns HTTP 404 for that dataset; the rest of the application keeps working.

**The catalog is built once, at startup.** A `.nc` file added while the application is running stays invisible, including to a request naming it directly: the application has to be restarted. The full procedure, including the special case of files added inside an existing subfolder of `individual/`, is in [DEPLOYMENT.md](DEPLOYMENT.md#adding-new-data).

Configuration can be supplied three ways (highest priority first): command-line arguments, environment variables, or a `config/application.properties` file next to the JAR. A commented bilingual template is provided in [`config/application.properties`](config/application.properties).

---

## Run

### Development (hot reload)

Two servers in parallel:

```bash
./gradlew bootRun                 # backend on :8080
cd frontend && npm run dev        # frontend on :5173, proxies /api to :8080
```

Open http://localhost:5173.

Your machine's data paths belong in `config/application-local.properties`, an unversioned file that `config/application.properties` imports automatically. It saves editing the shipped configuration template, which should only ever hold neutral example paths:

```properties
netcdf.mean.path=D:/mars-data/mean
netcdf.individual.path=D:/mars-data/individual
```

### Production (single JAR)

```bash
./gradlew build                                    # compiles frontend + backend, runs tests
java -jar build/libs/mars-visualizer-0.0.1-SNAPSHOT.jar
```

The JAR contains the interface and the API; open http://localhost:8080.

### Launch parameters

Any property can be passed on the command line with `--<property>=<value>`, or as an environment variable:

```bash
# Custom port and data paths
java -jar mars-visualizer.jar \
  --server.port=9000 \
  --netcdf.mean.path=//srv-iasb/gem-mars/mean \
  --netcdf.individual.path=//srv-iasb/gem-mars/individual

# Same thing with environment variables
SERVER_PORT=9000 \
NETCDF_MEAN_PATH=/mnt/gem-mars/mean \
NETCDF_INDIVIDUAL_PATH=/mnt/gem-mars/individual \
java -jar mars-visualizer.jar

# Verbose logs for a first deployment
java -jar mars-visualizer.jar --logging.level.com.mars.visualizer=DEBUG

# Bind to a single interface (behind a reverse proxy)
java -jar mars-visualizer.jar --server.address=127.0.0.1
```

Server installation, systemd service and reverse-proxy setup: **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## Build and test commands

### Gradle (repository root)

| Command | Effect |
|---|---|
| `./gradlew bootRun` | Starts the backend on :8080 (rebuilds the frontend first) |
| `./gradlew build` | Full build: frontend, compilation, tests, JAR in `build/libs/` |
| `./gradlew build -x test` | Same without the test suite |
| `./gradlew bootJar` | JAR only, no tests |
| `./gradlew test` | JUnit 5 suite (164 tests) + JaCoCo coverage report |
| `./gradlew buildFrontend` | Frontend production build only |

Coverage report: `build/reports/jacoco/test/html/index.html`.

### npm (`frontend/`)

| Command | Effect |
|---|---|
| `npm run dev` | Vite dev server on :5173 with hot reload |
| `npm run build` | Production build into `frontend/dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run test` | Vitest suite (150 tests) |
| `npm run lint` | ESLint check |

---

## Visualizations

| View | Route | Shows |
|---|---|---|
| Slice 2D | `/slice` | lat/lon map at one time step and altitude level |
| Animation | `/animation` | full diurnal cycle, 48 frames |
| Time series | `/timeseries` | one variable over the day at a single point |
| Vertical profile | `/profile` | one variable over the whole air column |
| Cross-section | `/crosssection` | altitude × latitude (meridional) or × longitude (zonal) |
| Zonal mean | `/zonalmean` | longitudinal average, altitude × latitude |
| Hovmöller | `/hovmoller` | space × time diagram |
| Temporal profile | `/temporal-profile` | altitude × local time above one point |
| Wind rose | `/windrose` | wind direction/speed distribution at a point |
| Difference | `/difference` | anomaly map between two datasets |
| Explore | `/explore` | console: up to 4 linked views, probe, region statistics, sessions |
| Legal notice | `/legal` | publisher, code licence, data provenance and citation, browser storage |

All views support permalinks, CSV export, PNG/SVG export, log₁₀ scale and colorscale selection. Interfaces are available in English, French, Dutch, German and Spanish.

The Explore console holds up to four views side by side, tied together by a shared probe and a common region selection, so the same point can be read across several diagnostics at once:

![Explore console: three linked views laid out in a grid](docs/images/explorer.en.png)

---

## REST API

All endpoints answer JSON and validate their parameters (HTTP 400 with a localized message on an invalid value, 404 on an unknown dataset).

| Endpoint | Description |
|---|---|
| `GET /api/catalog` | MEAN dataset catalog |
| `GET /api/catalog/individual` | Individual Martian year catalog |
| `GET /api/data/slice` | 2D lat/lon grid |
| `GET /api/data/timeseries` | 48 values at a point |
| `GET /api/data/animation` | 48 frames for the diurnal cycle |
| `GET /api/data/profile` | Vertical profile at a point |
| `GET /api/data/crosssection` | Meridional or zonal cross-section |
| `GET /api/data/zonalmean` | Zonal mean (altitude × latitude) |
| `GET /api/data/hovmoller` | Hovmöller diagram (space × time) |
| `GET /api/data/temporal-profile` | Temporal profile (altitude × time) |
| `GET /api/data/difference` | Difference between two datasets |
| `GET /api/data/wind` | Sub-sampled wind field (UU/VV) |
| `GET /api/data/windrose` | Wind rose at a point |
| `GET /api/data/transect` | Great-circle transect between two points |
| `GET /api/data/tides` | Thermal tides (diurnal and semi-diurnal harmonics) |
| `GET /api/data/altitudes` | Altitude levels available for a variable |
| `GET /api/export/csv/*` | CSV export per view type |
| `GET /api/export/netcdf/slice` | NetCDF export of a slice |

Common parameters: `dataset` (catalog id), `variable` (scientific code, e.g. `TT`, `H2O`, `P0`), `time` (0–47, local-time index in half hours), `altitude` (0–102, model level index), `latitude` (−90…90), `longitude` (−180…180).

Example:

```bash
curl "http://localhost:8080/api/data/slice?dataset=<id>&variable=TT&time=24&altitude=49"
```

---

## Documentation

| File | Content |
|---|---|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Server installation, systemd service, reverse proxy |
| [config/application.properties](config/application.properties) | Commented configuration template |
| [deploy/](deploy/) | Ready-to-copy systemd unit and Nginx block, with the three network variants |

---

## License

MIT — © 2026 Ludovic Vanden Berghe. GEM-Mars data produced by the Royal Belgian Institute for Space Aeronomy (BIRA-IASB).
