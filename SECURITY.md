# Security Policy

## Supported Versions

Only the latest release of Mars Climate Viewer, which is the version running in
production, receives security updates.

| Version | Supported |
| ------- | --------- |
| Latest release | ✅ |
| Older versions | ❌ |

## Reporting a Vulnerability

Please do not disclose security vulnerabilities through public GitHub issues.

Report them privately through GitHub's private vulnerability reporting:
[report a vulnerability](https://github.com/ludvdber/MCV/security/advisories/new).

Please include, if possible:

- the affected version
- a description of the vulnerability
- steps to reproduce
- the potential security impact
- relevant logs or screenshots

Security reports will be investigated before any public disclosure.

## Verifying a Release

Releases are built by GitHub Actions from this repository, not on a
workstation, and carry a signed build provenance attestation covering the JAR
and the deployment files published with it. To check that a downloaded file
comes from this repository and its release workflow:

```bash
gh attestation verify mars-visualizer.jar --repo ludvdber/MCV
```

Each release also publishes `SHA256SUMS.txt` (`sha256sum -c SHA256SUMS.txt`)
and the attestation bundle itself (`*.sigstore.json`), which can be verified
without GitHub.
