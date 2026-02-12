# Mars Climate Viewer

Visualisation web des donnees atmospheriques martiennes (modele GEM-Mars).

**TFE Bachelier Informatique - ISFCE 2026**

---

## Structure

- **Backend** : Spring Boot 4.0.2 / Java 21 - API REST
- **Frontend** : React 18 + Vite + Material-UI

---

## Installation

### Prerequis
- Java 21
- Node.js 20+
- Datasets NetCDF dans le repertoire configuré dans `application.properties`

### Build
```bash
cd frontend && npm install && cd ..
./gradlew build
```

---

## Lancement

```bash
# Backend (port 8080)
./gradlew bootRun

# Frontend (port 5173)
cd frontend && npm run dev
```

---

## API REST

| Endpoint | Description |
|---|---|
| `GET /api/catalog` | Liste des datasets |
| `GET /api/data/slice` | Extraction 2D [lat][lon] |
| `GET /api/data/timeseries` | Serie temporelle (48 pas de temps) |
| `GET /api/data/animation` | 48 frames pour animation diurne |
| `GET /api/export/csv/slice` | Export CSV d'une coupe |
| `GET /api/export/csv/timeseries` | Export CSV d'une serie temporelle |

---

## Stack technique

**Backend** : Spring Boot, NetCDF-Java (cdm-core 5.9.1), Lombok, Gradle 9
**Frontend** : React, Plotly.js, MUI, Axios
