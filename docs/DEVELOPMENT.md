# Development

*Version française : [DEVELOPMENT.fr.md](DEVELOPMENT.fr.md)*

Building, testing and continuous integration. The
[README](../README.md) keeps only the commands themselves; the figures and the
reasoning behind the two test suites live here, where they can change without
rewriting the front page.

---

## Build and test commands

### Gradle (repository root)

| Command | Effect |
|---|---|
| `./gradlew bootRun` | Starts the backend on :8080 (rebuilds the frontend first) |
| `./gradlew build` | Full build: frontend, compilation, tests, JAR in `build/libs/` |
| `./gradlew build -x test` | Same without the test suite |
| `./gradlew bootJar` | JAR only, no tests |
| `./gradlew test` | JUnit 5 suite (460 tests) + JaCoCo coverage report |
| `./gradlew buildFrontend` | Frontend production build only |

Coverage report: `build/reports/jacoco/test/html/index.html`. Currently 96.1% of instructions, 87.5% of branches, 95.8% of lines.

### npm (`frontend/`)

| Command | Effect |
|---|---|
| `npm run dev` | Vite dev server on :5173 with hot reload |
| `npm run build` | Production build into `frontend/dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run test` | Vitest suite (1407 tests, jsdom) |
| `npm run test:e2e` | End-to-end suite (69 tests) in a real Chromium |
| `npx vitest run --coverage` | Same, with the coverage report in `frontend/coverage/` |
| `npm run lint` | ESLint check |

The two suites prove different things. The Vitest one runs in jsdom, which has
no layout engine: no box has a position or a size, and `clip-path` does not
exist. It proves logic, never appearance. The end-to-end suite opens a real
browser against the served application and checks seven invariants: no empty plot
container, no element overlapping another of the same kind, no overlap between
two different families such as a title and a toolbar, on-screen statistics that
are arithmetically possible, no horizontal overflow at 390, 820 and 1600 pixels,
no touch target under 24 by 24 pixels, and no slider without an accessible name
and a readable value text. It covers the A/B curtain, the eleven
visualization pages, the console grids and tools, phone rendering, and the real
journeys: keyboard, permalink, export, five locales. Three defects lived in
production under a green jsdom suite because all three were geometric: a plot
container at full size with nothing drawn in it, two statistics bars at the same
coordinates sliced by the curtain, and two centred titles overlapping by 94%.

```bash
npm run test:e2e                                          # targets localhost:5173
MCV_E2E_URL=https://mars.example.be npm run test:e2e      # targets a deployment
```

`MCV_E2E_API` reroutes `/api` to another server, so a local interface can be
exercised against a backend that actually holds the data.

Frontend coverage is currently 90.5% of statements and 93.8% of lines. The
Vitest configuration sets `coverage.all`, so a file no test imports still counts
towards the denominator: removing that flag would inflate the figure without a
single new test being written.

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push and every pull request, in two
parallel jobs:

| Job | Does |
|---|---|
| Backend | Java 21, `./gradlew build jacocoTestReport` (compiles the frontend, runs the JUnit suite, produces the JAR) |
| Frontend | `npm ci`, ESLint, Vitest with coverage |

Test reports, the coverage report and the produced JAR are kept as build
artifacts for 14 days, so a failure can be read without reproducing the build
locally.

The workflow makes `gradlew` executable before calling it. The repository is
developed on Windows, which has no execute bit, so the file is stored as `100644`
in the index and `./gradlew` would fail with *Permission denied* on a Linux
runner. To fix it permanently in the repository instead:

```bash
git update-index --chmod=+x gradlew
```
