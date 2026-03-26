import { Box, Typography, Paper } from '@mui/material';

/**
 * Mini Mars location indicator — shows a point on a flat Mars projection.
 * Lightweight SVG, no 3D. Used on profile/timeseries pages for geographic context.
 *
 * @param {number} lat - Latitude (-90 to 90)
 * @param {number} lon - Longitude (-180 to 180)
 * @param {number} [size=120] - Width in pixels
 */
export default function MiniMarsMap({ lat, lon, size = 120 }) {
  if (lat == null || lon == null) return null;

  const h = size / 2;
  // Convert lat/lon to SVG coordinates
  const x = ((lon + 180) / 360) * size;
  const y = ((90 - lat) / 180) * h;

  return (
    <Paper sx={{ p: 0.5, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', borderRadius: 2 }}>
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} style={{ borderRadius: 6, display: 'block' }}>
        {/* Mars surface gradient background */}
        <defs>
          <linearGradient id="mars-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a6fa5" />
            <stop offset="30%" stopColor="#8b6914" />
            <stop offset="50%" stopColor="#c1440e" />
            <stop offset="70%" stopColor="#a0522d" />
            <stop offset="100%" stopColor="#d4a574" />
          </linearGradient>
        </defs>
        <rect width={size} height={h} fill="url(#mars-bg)" rx={6} />

        {/* Latitude grid lines */}
        {[-60, -30, 0, 30, 60].map(gridLat => {
          const gy = ((90 - gridLat) / 180) * h;
          return <line key={gridLat} x1={0} y1={gy} x2={size} y2={gy} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />;
        })}
        {/* Longitude grid lines */}
        {[-120, -60, 0, 60, 120].map(gridLon => {
          const gx = ((gridLon + 180) / 360) * size;
          return <line key={gridLon} x1={gx} y1={0} x2={gx} y2={h} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />;
        })}

        {/* Selected point */}
        <circle cx={x} cy={y} r={4} fill="var(--mars-orange)" stroke="white" strokeWidth={1.5} />
        <circle cx={x} cy={y} r={8} fill="none" stroke="var(--mars-orange)" strokeWidth={0.8} opacity={0.5} />
      </svg>
      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'var(--text-secondary)', mt: 0.3 }}>
        {lat.toFixed(1)}° N, {lon.toFixed(1)}° E
      </Typography>
    </Paper>
  );
}
