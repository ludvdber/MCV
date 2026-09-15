# Changelog

All notable changes to Mars Climate Viewer. Dates are ISO (YYYY-MM-DD).
French version: [CHANGELOG.fr.md](CHANGELOG.fr.md)

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
- **The A/B curtain now lets you choose what it compares.** Pane B was always
  the first other comparable slice: the action that would have changed it
  existed in the state machine and was emitted from nowhere. Its name appeared
  only in the button tooltip, which a touch screen never shows and which is
  replaced by "Exit" the moment the curtain opens. Both panes are now named in
  plain text before opening: A is the active view, B is a list you pick from.

### Verified

Measured against the institute's real data, not fixtures:

| Layer | Result |
|---|---|
| Backend | 448 tests, 0 failures, 96.0% instruction coverage, 87.4% branches |
| Frontend (jsdom) | 1391 tests, 0 failures, 90.6% statements, 93.9% lines |
| End-to-end (Chromium) | 66 tests, 0 failures against this JAR |
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
