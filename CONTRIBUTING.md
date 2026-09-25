# Contributing to Mars Climate Viewer

*Version française : [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md)*

Thank you for taking the time. Bug reports, questions, corrections to the
documentation and code changes are all welcome.

## Reporting a bug or asking for a feature

Open an issue on GitHub:
[github.com/ludvdber/MCV/issues](https://github.com/ludvdber/MCV/issues).
A useful bug report says:

- what you did (the page, the dataset, the variable, or a permalink, which
  carries all of it);
- what you expected, and what happened instead;
- your browser, or the server log lines if the problem is on the server side.

Issues are public. **Do not report a security vulnerability in an issue**:
follow [SECURITY.md](SECURITY.md) to report it privately.

## Proposing a change

1. Fork the repository and create a branch from `master`.
2. Make your change, with its tests (see below).
3. Run the checks locally:

   ```bash
   ./gradlew build                  # backend tests + JAR
   cd frontend
   npm run lint
   npm run test                     # Vitest suite
   ```

4. Open a pull request against `master`. Describe what the change does and why;
   a screenshot helps for anything visible.

Every pull request runs the continuous integration (backend and frontend
suites), CodeQL static analysis and a dependency review. A pull request is
merged only when all of them pass. `master` is protected: it cannot be deleted
or force-pushed, and a commit is accepted only once CodeQL has analysed it.

How to build and run the project, and what each test suite proves:
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Requirements for a contribution

### Tests are part of the change

**New functionality comes with automated tests, and a bug fix comes with a test
that fails without the fix.** This is the project's test policy, and it applies
to every pull request:

- backend: JUnit 5 in `src/test/java` (`./gradlew test`);
- frontend logic: Vitest in `frontend/src/**/*.test.js(x)` (`npm run test`);
- anything visible (layout, rendering, overlap, keyboard): an invariant in the
  end-to-end suite, `frontend/e2e/` (`npm run test:e2e`, needs a served
  application with data).

Before trusting a new test, check that it fails on the code it is meant to
guard. A test that passes both before and after a fix proves nothing about it.

### Conventions of this codebase

- **Every user-visible string is translated**, through `t('key')` on the
  frontend and `MessageSource` on the backend, in all five languages (`en`,
  `fr`, `nl`, `de`, `es`), with the same set of keys. Scientific codes (`TT`,
  `UU`), units (`K`, `Pa`) and dataset names are never translated.
- **Machine-readable output is formatted with `Locale.ROOT`** (CSV headers,
  filenames, NetCDF attributes). The locale of the server must never change a
  file another program reads.
- **The GEM-Mars file names are fixed by the upstream pipeline** and must not be
  renamed: dataset identifiers, Mars years and Ls ranges are derived from them.
- **NetCDF files are read partially**: only the requested slice, timestep or
  level is read from disk.
- Match the style of the code around your change. ESLint must report no errors.

### Licence

By contributing, you agree that your contribution is released under the
project's [MIT license](LICENSE).

## Code of conduct

Be respectful and constructive. Discuss the work, not the person.
