# Security Policy

## Supported Versions

Only the latest release of Mars Climate Viewer receives security updates.

| Version | Supported |
| ------- | --------- |
| Latest  | ✅ |
| Older versions | ❌ |

## Reporting a Vulnerability

If you discover a security vulnerability in Mars Climate Viewer, please do not
publish it in a public GitHub issue.

Report it privately through GitHub Security Advisories:
[report a vulnerability](https://github.com/ludvdber/MCV/security/advisories/new).

Include, if possible:

- A description of the vulnerability
- Steps to reproduce the issue
- The affected version
- Any potential security impact

I will investigate security reports as soon as possible.

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
