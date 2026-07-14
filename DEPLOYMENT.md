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

The application honours `X-Forwarded-*` headers (`server.forward-headers-strategy=framework` is already enabled). Behind Nginx or Caddy with HTTPS, no extra MCV-side setting is needed.
