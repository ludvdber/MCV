# Mars Climate Viewer

Visualisation web des donnees atmospheriques martiennes (modele GEM-Mars).

**TFE Bachelier Informatique - ISFCE 2026**

---

## Structure du projet

```
mars-visualizer/
├── src/main/java/          # Backend Spring Boot (API REST, lecture NetCDF)
├── frontend/src/
│   ├── components/         # Composants React reutilisables (viewers, selectors, UI)
│   ├── hooks/              # Hooks personnalises (usePlotRef, useCopyToClipboard, …)
│   ├── pages/              # Pages de visualisation (Slice, Animation, Profile, …)
│   ├── utils/              # Utilitaires (palettes, export, analyse)
│   ├── context/            # Contexte global (MarsContext)
│   └── services/           # Client API (Axios, cache)
└── build.gradle
```

---

## Stack technique

| Couche | Technologies |
|---|---|
| **Backend** | Spring Boot 4.1.0, Java 21, NetCDF-Java (cdm-core 5.9.1), Gradle 9 |
| **Frontend** | React 19, Vite 8, Plotly.js, Three.js / React-Three-Fiber, Material-UI 7, Axios |

---

## Installation

### Prerequis
- Java 21
- Node.js 20+
- Datasets NetCDF dans le repertoire configure dans `application.properties`

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

## Fonctionnalites

| Page | Description |
|---|---|
| **Slice 2D** (`/slice`) | Carte heatmap lat/lon a un pas de temps et une altitude |
| **Animation** (`/animation`) | Cycle diurne anime (48 frames) |
| **Serie temporelle** (`/timeseries`) | Courbe diurne en un point geographique |
| **Profil vertical** (`/profile`) | Valeur d'une variable sur tous les niveaux d'altitude |
| **Coupe verticale** (`/crosssection`) | Coupe meridionale ou zonale (heatmap altitude × coord) |
| **Exploration** (`/explore`) | Comparaison multi-variables, multi-datasets |

Toutes les pages supportent : permaliens, export CSV, export PNG/SVG (Plotly), echelle logarithmique (log₁₀) et choix de palette de couleurs.

---

## API REST

### Donnees

| Endpoint | Description |
|---|---|
| `GET /api/catalog` | Catalogue des datasets MEAN |
| `GET /api/catalog/individual` | Catalogue des annees martiennes individuelles |
| `GET /api/data/slice` | Extraction 2D [lat][lon] |
| `GET /api/data/timeseries` | Serie temporelle (48 pas de temps) |
| `GET /api/data/animation` | 48 frames pour animation diurne |
| `GET /api/data/profile` | Profil vertical en un point |
| `GET /api/data/crosssection` | Coupe verticale meridionale ou zonale |
| `GET /api/data/wind` | Champ de vent sous-echantillonne (UU/VV) |

### Exports CSV

| Endpoint | Description |
|---|---|
| `GET /api/export/csv/slice` | Export CSV d'un slice |
| `GET /api/export/csv/timeseries` | Export CSV d'une serie temporelle |
| `GET /api/export/csv/profile` | Export CSV d'un profil vertical |
| `GET /api/export/csv/crosssection` | Export CSV d'une coupe verticale |

---

## Architecture frontend

### Hooks personnalises

| Hook | Role |
|---|---|
| `usePlotRef` | Ref conteneur viewer + ref synthetique Plotly pour l'export |
| `useCopyToClipboard` | Copie presse-papier avec retour visuel temporaire |
| `useResolvedColorscale` | Resolution palette auto (RdBu pour temperatures, Viridis sinon) |

### Composants partages

| Composant | Role |
|---|---|
| `VisuToggle` | Bouton toggle outlined/contained reutilisable |
| `PermalienButton` | Bouton permalien avec feedback visuel |
| `StatsBar` | Barre statistiques (min, max, moyenne, ecart-type) |
| `ColorscaleSelector` | Selecteur de palette Plotly |
| `LocationsLegend` | Legende des points d'interet martiens |
| `PageLoader` | Indicateur de chargement centre |
