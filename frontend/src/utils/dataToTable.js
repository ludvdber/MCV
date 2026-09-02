/**
 * Converts visualization data into columns + rows for DataTableView.
 * Returns { columns: [{label, key}], rows: [{...}] }
 *
 * Ces fonctions sont TOTALES : une reponse serveur inattendue (corps tronque,
 * `data: null`, page HTML renvoyee par un proxy) produit un tableau vide, jamais
 * une exception. Sans cela, le `.length` sur undefined remontait jusqu'a
 * l'ErrorBoundary et effacait l'application entiere.
 */

/** Vrai si `v` est un tableau non vide (une grille vide n'a rien a afficher) */
const isFilledArray = (v) => Array.isArray(v) && v.length > 0;

/** Slice / Difference — 2D grid (lat × lon) */
export function gridToTable(data, latitudes, longitudes, valueLabel = 'value') {
  return grid2DToTable(data, latitudes, longitudes, 'Latitude (°)', 'Longitude (°)', valueLabel);
}

/** Time series — 1D (timestep × value) */
export function timeSeriesToTable(values, unit = '') {
  const columns = [
    { label: 'Timestep', key: 'timestep' },
    { label: 'Time (h)', key: 'time' },
    { label: `Value${unit ? ` (${unit})` : ''}`, key: 'value' },
  ];
  if (!isFilledArray(values)) return { columns, rows: [] };
  const rows = values.map((v, i) => ({
    timestep: i,
    time: ((i + 1) * 0.5).toFixed(1),
    value: v,
  }));
  return { columns, rows };
}

/** Profile — 1D (altitude × value) */
export function profileToTable(values, altitudes, unit = '') {
  const columns = [
    { label: 'Altitude (km)', key: 'alt' },
    { label: `Value${unit ? ` (${unit})` : ''}`, key: 'value' },
  ];
  if (!isFilledArray(values)) return { columns, rows: [] };
  const rows = values.map((v, i) => ({
    alt: altitudes?.[i] ?? i,
    value: v,
  }));
  return { columns, rows };
}

/** Animation — all frames (timestep × lat × lon) */
export function animationToTable(frames, latitudes, longitudes, valueLabel = 'value') {
  const columns = [
    { label: 'Timestep', key: 'timestep' },
    { label: 'Time (h)', key: 'time' },
    { label: 'Latitude (°)', key: 'lat' },
    { label: 'Longitude (°)', key: 'lon' },
    { label: valueLabel, key: 'value' },
  ];
  const rows = [];
  if (!isFilledArray(frames)) return { columns, rows };
  for (let t = 0; t < frames.length; t++) {
    const frame = frames[t];
    if (!Array.isArray(frame)) continue;
    for (let i = 0; i < frame.length; i++) {
      const line = frame[i];
      if (!Array.isArray(line)) continue;
      for (let j = 0; j < line.length; j++) {
        rows.push({
          timestep: t,
          time: ((t + 1) * 0.5).toFixed(1),
          lat: latitudes?.[i] ?? i,
          lon: longitudes?.[j] ?? j,
          value: line[j],
        });
      }
    }
  }
  return { columns, rows };
}

/** Cross-section / Hovmöller / Zonal Mean — 2D grid with custom axes */
export function grid2DToTable(data, rowCoords, colCoords, rowLabel, colLabel, valueLabel = 'value') {
  const columns = [
    { label: rowLabel, key: 'row' },
    { label: colLabel, key: 'col' },
    { label: valueLabel, key: 'value' },
  ];
  const rows = [];
  if (!isFilledArray(data)) return { columns, rows };
  for (let i = 0; i < data.length; i++) {
    const line = data[i];
    if (!Array.isArray(line)) continue;
    for (let j = 0; j < line.length; j++) {
      rows.push({
        row: rowCoords?.[i] ?? i,
        col: colCoords?.[j] ?? j,
        value: line[j],
      });
    }
  }
  return { columns, rows };
}
