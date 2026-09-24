# Changelog

All notable changes to Mars Climate Viewer. Dates are ISO (YYYY-MM-DD).
French version: [CHANGELOG.fr.md](CHANGELOG.fr.md)

## v1.0.1 — 2026-09-24

Security and supply-chain release. Nothing changes in what the application
shows or computes. Upgrading from 1.0.0: replace the JAR and restart; the
configuration file and the deployment files are unchanged. What Mars Climate
Viewer is and how to install it: see the [README](https://github.com/ludvdber/MCV#readme).

### Security

- **Tomcat 11.0.25.** The embedded web server, which is the part of MCV exposed
  to the internet, was on 11.0.22, which carries three critical advisories
  (GHSA-9xv2-5v5q-p794, GHSA-gcx9-497g-6cp6, GHSA-h3x4-894j-xpx5). They concern
  the DIGEST and FORM authentication mechanisms, which MCV does not use, so the
  real exposure was low; a public server still should not run a version known
  to be vulnerable. Spring Boot 4.1.1 alone ships 11.0.24, so the version is
  pinned until Spring Boot catches up.
- **Spring Boot 4.1.1**, bringing Jackson 3.1.5 and Log4j API 2.25.5, each
  fixing a moderate advisory (GHSA-5gvw-p9qm-jgwh, GHSA-qv9r-c865-cp47).
  Neither reached MCV's code paths: it uses no `@JsonView`, and logging goes
  through Logback.
- **The Java dependencies are now watched.** GitHub's dependency graph listed
  936 npm packages and not a single Java one, so Dependabot had never looked
  at the server side. The advisories above were found by querying the OSV
  database with the resolved runtime classpath (58 dependencies, none
  vulnerable after this release). A workflow now submits that classpath to
  GitHub on every push.
- **maplibre-gl 6.11** (critical XSS advisory) and **fflate 0.6.11**
  (moderate). Neither was reachable, and this was measured rather than
  assumed: rebuilt with the old and the new versions, every JavaScript file of
  the bundle is identical except for the parts noted below. Plotly depends on
  maplibre-gl, but MCV loads none of Plotly's map traces, so no maplibre code
  ships; fflate ships partly, inside the 3D view, but not the function the
  advisory concerns. Both are updated anyway, so that no known-vulnerable
  version sits in the lockfile. The alternative Dependabot proposed, Plotly 4,
  is a major version and is left for a deliberate migration.
  The update does change two shipped files: Plotly's stylesheet now carries
  maplibre 6's styles (+1.2 KB compressed, unused), and `bidi-js`, shared with
  the 3D labels of the home page, moves from 1.0.3 to 1.1.0.
- **commons-lang3 3.20.0 in the build tooling** (moderate advisory
  CVE-2025-48924). It came in through the Spring Boot Gradle plugin, in the
  part that builds container images, and never reached the JAR; it is
  constrained anyway because the dependency graph GitHub watches includes the
  build classpath, and Dependabot cannot update a plugin's own dependency.
  After this release, OSV reports 0 known vulnerabilities across all 105 Java
  dependencies (runtime, build and tests).

### Dependencies

- **NetCDF-Java (cdm-core) 5.10.0**, the library that reads the GEM-Mars
  files. Checked against the real data rather than assumed: 37 requests
  covering every data endpoint, on two datasets, return the same 537,993
  values as version 1.0.0 in production, and the NetCDF export is identical
  byte for byte.
- **Gradle 9.7.1** (wrapper checksum verified against the one Gradle
  publishes) and Guava 33.7.1.
- **24 frontend minor and patch updates**, among them React 19.3, MUI 9.4,
  three.js 0.186, Vite 8.3 and axios 1.20. `@react-three/fiber` moves to 9.8,
  the first version that accepts React 19.3; without it the grouped update
  could not install at all.
- Major versions (Plotly 4, Vitest 5, ESLint 10) are left for deliberate
  migrations, and `eslint-plugin-react-hooks` stays on 7.0.1.

### Supply chain

- **This release is built by GitHub**, not on a workstation, and carries a
  signed build provenance attestation covering the JAR and the deployment
  files. How to verify a download: `SECURITY.md`.
- OpenSSF Scorecard runs weekly. Dependabot now watches Gradle and the GitHub
  Actions as well as npm, and every action is pinned by commit.
- A security policy (`SECURITY.md`) explains how to report a vulnerability
  privately.
- **Property-based tests** (fast-check) on the functions that take input
  nobody controls: permalink parameters, dataset identifiers, contour levels.
  Instead of checking the cases someone thought of, they state a rule and let
  the tool search for an input that breaks it. They found the two defects
  below on their first run.

### Fixed

- A local `./gradlew build` after a dependency-only update could embed the
  previous frontend bundle: the frontend build did not list `package.json` and
  the lockfile among its inputs, so Gradle considered it up to date.
- CodeQL could not read `index.html`. Its schema.org JSON-LD block was a bare
  JSON object, which a JavaScript parser reads as a block and a label; it is
  now a one-element array, valid as JSON-LD and as JavaScript. Search engines
  read the same data.
- Contour levels could ask Plotly for tens of thousands of lines when a range
  was narrower than about 1e-15 (50,000 for 32 intended), enough to freeze the
  tab, and could come out infinite near the limits of floating-point numbers.
  Real GEM-Mars fields are stored in 32-bit floats and never get that narrow,
  but hand-set colour bounds could. The figures drawn from real data are
  unchanged: the 27 ranges measured against Plotly itself still agree.
- The dataset part of an export filename is now always at most 40
  characters. A hand-edited permalink carrying an absurdly long identifier
  produced a name of any length.

### Verified

| Layer | Result |
|---|---|
| Backend | 460 tests, 0 failures |
| Frontend (jsdom) | 1418 tests (11 of them property-based), 0 failures, ESLint 0 errors |
| End to end, real Chromium against the built JAR | 69 tests, 0 failures, no server ERROR or WARN |
| Same data as 1.0.0, real files, compared with production | 37 requests, 537,993 values, 0 differences; NetCDF export byte-identical |
| Known vulnerabilities (OSV for Java, `npm audit` for the frontend) | 0 |

## v1.0.0 — 2026-09-15

First public release. Mars Climate Viewer is a web interface for the GEM-Mars
atmospheric model developed at the Royal Belgian Institute for Space Aeronomy
(BIRA-IASB). It reads the institute's NetCDF files where they already sit and
serves them as maps, profiles, cross-sections and time series, without
duplicating a single byte of the archive.

### What it does

- **11 visualization pages**: 2D map, animated diurnal cycle, time series,
  vertical profile, cross-section, zonal mean, Hovmöller diagram, temporal
  profile, wind rose, difference between two datasets, thermal tides.
- **An Explore console** that puts up to four linked views side by side, with a
  shared probe, an A/B curtain comparison, hand-drawn transects, region
  statistics and animated wind particles.
- **26 REST endpoints**: 16 for data and catalogues, 10 for exports.
- **Exports**: 9 CSV formats plus a NetCDF-3 export that genuinely honours the
  CF-1.8 conventions it declares.
- **Five languages**: English, French, Dutch, German, Spanish. Scientific codes,
  units and dataset names are deliberately never translated.
- **Partial reads**: only the requested slice, timestep or level is read from
  disk, so a multi-gigabyte file costs a few kilobytes of I/O per request.
- **Runs as a single JAR.** Java 21 or newer is the only requirement on the
  server. Node is needed to build, never to run.

### Notable in this build

- **The NetCDF export now says where it comes from.** It carries `dataset_id`,
  a `history` line, and CF scalar coordinate variables for time and altitude
  whose units are copied from the source file rather than assumed. Before this,
  the same variable at the same timestep and level exported from two opposite
  Martian seasons produced two files with the same name and byte-identical
  metadata.
- **Every data export filename now names its dataset.** The server always sent a
  complete `Content-Disposition`, but the browser download is named by the
  application, so the header never reached the disk. The wind rose export was
  the worst case: a constant `mars_windrose.csv` regardless of dataset, location
  and altitude.
- **Image exports carry the same provenance as data exports.** A PNG or SVG of a
  figure is what ends up in a talk or a paper, and it downloaded as
  `mars_slice_TT.png` whatever the dataset, local hour and altitude, so two
  figures from opposite Martian seasons collided and the browser silently named
  the second one "(1)". Twelve export menus now take the same base name as the
  data export of the same view, and a test reads the sources so the next one
  cannot ship without it.
- **The temporal profile refuses an individual dataset, like its five siblings.**
  An individual file holds a single timestep, so an altitude-by-time grid
  collapses to one column. `timeseries`, `animation`, `hovmoller`, `windrose` and
  `tides` all answered 400; the temporal profile answered 200 and drew that one
  column, on both the data endpoint and the CSV export. The frontend already
  classed it as MEAN-only, so the API was contradicting the interface.
- **French error messages no longer show doubled apostrophes.** Six of them read
  `n''est` on screen. The doubling is the `MessageFormat` convention, but Spring
  only runs a message through `MessageFormat` when it carries arguments, so a
  message without any was published exactly as written. Measured on the live
  site before the fix. A test now resolves every message through the production
  bean and holds both directions of the rule.
- **A slider pushed to either end no longer pushes the page sideways.** The
  thumb's touch halo (42 px) and its value bubble (up to 73 px, "143.9 km")
  overhang the rail, which sat flush with the edge of its card: at 390 px the
  page scrolled 4 px horizontally, and the altitude bubble was cut off by the
  screen edge at the top of the column. Sliders are now inset by 24 px, a figure
  measured against the widest bubble in the application. The end-to-end
  invariant that should have caught this was itself blind, reporting only
  offending *elements* and a pseudo-element has no rectangle: it now reports the
  overflow whether or not it can name a culprit.
- **Scientific symbols survive the export.** `Dust mixing ratio (0.1 µm)` used to
  become `(0.1 ?m)` in the three dust variables. NetCDF-3 attribute text must
  stay ASCII, but `um` preserves the meaning where `?` destroys it. Accents are
  now stripped by Unicode decomposition rather than replaced.
- **A configuration mistake is now readable.** Startup refusals print as
  `APPLICATION FAILED TO START` with separate Description and Action blocks, in
  French and English, without a stack trace: 34 lines instead of 53, of which 40
  used to be Java frames. The stack trace is still one flag away
  (`--logging.level.org.springframework.boot.diagnostics=DEBUG`). When an
  environment variable shadows the configuration file, the refusal says so and
  prints its value, because Spring ranks it above the file.
- **A configuration template is written next to the JAR on first launch**, and
  its absolute path is announced, so the error message never points at a file
  that does not exist.
- **The build pins UTF-8 source encoding**, so accented console messages no
  longer depend on the locale of the machine that compiled the JAR.
- **The JAR no longer ships three builds worth of dead JavaScript.** The task
  that packages the frontend copied without ever deleting, and Vite names every
  chunk after its own hash, so nothing was ever replaced: 163 files shipped for
  the 55 a build produces, 3 MB of orphans. A page removed from the router even
  stayed reachable at its old asset address. The JAR is 1 MB lighter.
- **The animated wind is capped at 60 frames per second, and its speed no
  longer depends on your monitor.** The loop followed the screen refresh rate
  with no bound: measured on the Explore console with four views in grid
  layout, 181 frames per second and 1.39 million pixels repainted per frame,
  three times the work of a 60 Hz screen for an identical picture. The
  advection constant was expressed per FRAME, so the wind also flowed three
  times faster there than on a 60 Hz screen. Everything that moves is now
  scaled by elapsed time, and a map that has scrolled off-screen stops
  animating instead of running for nobody.
- **Every exported image now names its dataset too.** The fix that gave CSV
  and NetCDF downloads their dataset, time and altitude never reached the
  PNG and SVG exports: a 2D map downloaded as `mars_slice_TT.png` whatever
  the dataset, local hour and altitude, and the wind rose as a constant
  `mars_windrose`. Two figures from opposite Martian seasons therefore
  collided, the browser naming the second one "(1)". An image export is what
  ends up in a paper or a talk, so it now takes the same base name as the
  data export of the same view.
- **The A/B curtain now lets you choose what it compares.** Pane B was always
  the first other comparable slice: the action that would have changed it
  existed in the state machine and was emitted from nowhere. Its name appeared
  only in the button tooltip, which a touch screen never shows and which is
  replaced by "Exit" the moment the curtain opens. Both panes are now named in
  plain text before opening: A is the active view, B is a list you pick from.
- **The zonal mean no longer collapses when you change a setting after drawing
  it.** Picking another dataset or another variable once a view was on screen
  took the whole route down to its error boundary, and "Retry" appeared to fix
  it only because the component was remounted from scratch. The cause is a
  Plotly contour trace whose levels are computed automatically: a redraw that
  skips the recalculation loses them, and the contour code then reads an empty
  level list. The levels are now stated explicitly, computed by the same rule
  Plotly applies, so the figures are unchanged, measured level by level.
- **The history now names datasets the way the selector does.** Each entry
  showed the raw pipeline filename,
  `hl-b274_032094p_ls000_0000_MY35_sol668to739_71days_mean_crossdir`, instead of
  "MY35 - Ls 0° to 30°". The pattern that was meant to make it readable required
  `MY` to come before `Ls`, and the pipeline writes the opposite, so it matched
  no real dataset at all and the fallback to the raw identifier fired every time.

- **A visitor who leaves mid-load is no longer logged as a server crash.** Closing
  a tab, navigating away or cancelling a request breaks the connection while the
  response is still being written. Each one produced a 77-line ERROR stack
  claiming the server had failed, and on the SPA routes a second WARN on top,
  because the error handler then tried to write a JSON body onto a response that
  had already left. Disconnects are now recognised through the chain of causes
  rather than the type that happens to be thrown, which is what the two wrappers
  measured here required, and nothing is written once a response is committed.
  Measured on the delivered JAR by forcing the failure: three ERROR entries
  before, none after, with genuine server faults still reported in full.

- **The server log now reports what the server did, not what visitors did wrong.**
  A malformed `Accept` header made the API answer **500** and announce a crash,
  while an `Accept` the API cannot serve produced an ERROR plus a second warning
  claiming the error handler itself had failed — both are the same Spring
  exception taking two different routes, and both are now answered 406 with no
  body and no noise. Per-read NetCDF details moved to DEBUG, which also removes
  a filesystem call made on every read purely to log it. Measured on the
  delivered JAR: an ordinary visit writes 7 lines instead of 10, and a full pass
  of hostile traffic — aborted downloads, bot scans, unsupported methods,
  out-of-range and malformed parameters — writes **no ERROR at all**, only
  one-line client-error reports. Both levels are restored by a commented line in
  the shipped `application.properties`.

### Verified

Measured against the institute's real data, not fixtures:

| Layer | Result |
|---|---|
| Backend | 460 tests, 0 failures, 96.3% instruction coverage, 87.4% branches |
| Frontend (jsdom) | 1407 tests, 0 failures, 90.6% statements, 93.9% lines |
| End-to-end (Chromium) | 69 tests, 0 failures against this JAR |
| Export audit | 560 checks across 23 CSV cases and 10 NetCDF cases |

Every exported value was compared three ways: the delivered file, the JSON the
interface displays, and the source GEM-Mars file read independently with the
netCDF4 C library. The NetCDF export was additionally validated field by field
against the NetCDF-3 binary specification.

### Known behaviour

- Surface temperature (`MTSF`) arrives from the current GEM-Mars pipeline with a
  +273.15 K offset that makes values physically impossible on Mars. The
  application detects and compensates it, and logs a warning each time. This is a
  temporary correction pending a pipeline fix, and it applies to exports as well.
- The end-to-end suite is not part of continuous integration, because the runner
  has no NetCDF data. Run it against a deployment before releasing:
  `MCV_E2E_URL=https://… npm run test:e2e`.

### Installing

Download `mars-visualizer.jar`, put it in a folder, and run
`java -jar mars-visualizer.jar`. On first launch it writes
`config/application.properties` next to itself and tells you where; fill in the
two NetCDF paths and start it again. Full guide: [DEPLOYMENT.md](DEPLOYMENT.md).

Verify your download against `SHA256SUMS.txt`:
`sha256sum -c SHA256SUMS.txt`.
