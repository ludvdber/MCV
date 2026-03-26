/**
 * Converts visualization data into columns + rows for DataTableView.
 * Returns { columns: [{label, key}], rows: [{...}] }
 */

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
  for (let t = 0; t < frames.length; t++) {
    const frame = frames[t];
    for (let i = 0; i < frame.length; i++) {
      for (let j = 0; j < frame[i].length; j++) {
        rows.push({
          timestep: t,
          time: ((t + 1) * 0.5).toFixed(1),
          lat: latitudes?.[i] ?? i,
          lon: longitudes?.[j] ?? j,
          value: frame[i][j],
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
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      rows.push({
        row: rowCoords?.[i] ?? i,
        col: colCoords?.[j] ?? j,
        value: data[i][j],
      });
    }
  }
  return { columns, rows };
}
