/**
 * Rideau A/B — le geste signature de NASA Worldview applique a MCV.
 *
 * Superpose deux SliceViewers de la MEME variable : le volet B est decoupe
 * par un clip-path dont le bord suit une poignee glissante. Les deux vues
 * partagent une echelle de couleurs commune (min/max des deux jeux de
 * donnees) pour que la comparaison soit scientifiquement honnete et que la
 * jointure soit invisible.
 *
 * Le mode anomalie est ignore ici (on compare des valeurs brutes) ; en
 * echelle log, chaque volet garde son echelle propre (pas de range force).
 */
import { useRef, useState, useCallback } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useExploreState } from './ExploreContext.jsx';
import { useResultColorscale } from './useResultColorscale.js';
import SliceViewer from '../../components/SliceViewer';
import StatsBar from '../../components/StatsBar';

export default function CurtainCompare({ resultA, resultB, sharedPlotRef = null }) {
  const { t } = useTranslation();
  const state = useExploreState();
  const { showLocations, showDetailedTooltip, showLog, smoothHeatmap, interpStep } = state;

  const boxRef = useRef(null);
  const [pct, setPct] = useState(50);
  const draggingRef = useRef(false);

  /* Palette de la vue active (volet A) : les deux volets la partagent pour que
   * la comparaison reste honnête. Elle suit désormais l'override par vue. */
  const resolved = useResultColorscale(resultA, { showAnomaly: false, colorscale: resultA?.colorscale ?? 'auto' });

  // Echelle commune : bornes des deux datasets (stats renvoyees par l'API).
  const statsA = resultA?.data?.stats;
  const statsB = resultB?.data?.stats;
  const commonZ = (!showLog && statsA && statsB)
    ? { zmin: Math.min(statsA.min, statsB.min), zmax: Math.max(statsA.max, statsB.max) }
    : { zmin: null, zmax: null };

  const updateFromEvent = useCallback((e) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((e.clientX - rect.left) / rect.width) * 100;
    setPct(Math.max(4, Math.min(96, p)));
  }, []);

  const onPointerDown = useCallback((e) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);
  const onPointerMove = useCallback((e) => {
    if (draggingRef.current) updateFromEvent(e);
  }, [updateFromEvent]);
  const onPointerUp = useCallback(() => { draggingRef.current = false; }, []);

  const viewerProps = {
    showLocations,
    showSurface: false,
    showDetailedTooltip,
    colorscaleName: resolved.name,
    reverseColorscale: resolved.reverse,
    customZMin: commonZ.zmin,
    customZMax: commonZ.zmax,
    logScale: showLog,
    smooth: smoothHeatmap,
    interpStep,
    noExportMenu: true,
    hideStats: true,
  };

  return (
    <Box>
      <Box ref={boxRef} sx={{ position: 'relative' }}>
        {/* Volet A (dessous, plein) */}
        {/* Le titre du graphe est celui du volet A, mais il surplombe les DEUX
            volets : sans le prefixe « A · » il donnerait le jeu de gauche pour
            celui de toute l'image, y compris dans une figure exportee. Le
            volet B, lui, ne dessine plus de titre du tout (il se posait sur
            celui-ci) : son jeu est nomme par sa pastille et par sa barre. */}
        <SliceViewer
          sliceData={resultA.data}
          variableCode={resultA.params.variable}
          datasetLabel={`A · ${resultA.datasetLabel || resultA.label}`}
          externalPlotRef={sharedPlotRef}
          {...viewerProps}
        />

        {/* Volet B (dessus, decoupe a droite de la poignee) */}
        <Box sx={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${pct}%)` }}>
          <SliceViewer
            sliceData={resultB.data}
            variableCode={resultB.params.variable}
            datasetLabel={resultB.datasetLabel}
            titleText=""
            {...viewerProps}
          />
        </Box>

        {/* Etiquettes A / B */}
        <Chip
          label={`A · ${resultA.datasetLabel || resultA.label}`}
          size="small"
          sx={{
            position: 'absolute', top: 8, left: 8, zIndex: 3, maxWidth: '42%',
            bgcolor: 'rgba(10, 12, 19, 0.75)', color: 'var(--sand, #d9a066)',
            border: '1px solid rgba(217, 160, 102, 0.5)', backdropFilter: 'blur(6px)',
          }}
        />
        <Chip
          label={`B · ${resultB.datasetLabel || resultB.label}`}
          size="small"
          sx={{
            position: 'absolute', top: 8, right: 8, zIndex: 3, maxWidth: '42%',
            bgcolor: 'rgba(10, 12, 19, 0.75)', color: 'var(--cyan-accent, #38bdf8)',
            border: '1px solid rgba(56, 189, 248, 0.5)', backdropFilter: 'blur(6px)',
          }}
        />

        {/* Poignee du rideau */}
        <Box
          role="slider"
          aria-label={t('explore.curtain.handle')}
          aria-valuenow={Math.round(pct)}
          aria-valuemin={4}
          aria-valuemax={96}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setPct(p => Math.max(4, p - 2));
            if (e.key === 'ArrowRight') setPct(p => Math.min(96, p + 2));
          }}
          sx={{
            position: 'absolute', top: 0, bottom: 0, zIndex: 4,
            left: `${pct}%`, width: 28, ml: '-14px',
            cursor: 'ew-resize', touchAction: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            '&::before': {
              content: '""', position: 'absolute', top: 0, bottom: 0,
              left: '50%', width: 2, ml: '-1px',
              bgcolor: 'rgba(236, 235, 230, 0.9)',
              boxShadow: '0 0 12px rgba(56, 189, 248, 0.8)',
            },
            '&:focus-visible': { outline: 'none', '&::before': { bgcolor: 'var(--cyan-accent, #38bdf8)' } },
          }}
        >
          <Box sx={{
            width: 28, height: 28, borderRadius: '50%', zIndex: 1,
            display: 'grid', placeItems: 'center', fontSize: 14,
            bgcolor: 'rgba(10, 12, 19, 0.9)', color: 'var(--cyan-accent, #38bdf8)',
            border: '1px solid rgba(255, 255, 255, 0.25)', userSelect: 'none',
          }}>
            ⇆
          </Box>
        </Box>
      </Box>

      {/* Les statistiques des DEUX volets, etiquetees. Chaque SliceViewer
          rendait la sienne au meme endroit : le rideau tranchait la pile et la
          barre lue melangeait les jeux — mesure sur deux slices TT, min et max
          venus du volet A (140,6 / 173,6) mais ecart-type et mediane du volet B
          (8,034 / 168,1), d'ou des moyennes hors des bornes affichees. Une
          barre par volet supprime la question. */}
      <Box sx={{ mt: 1, display: 'grid', gap: 0.5 }}>
        {[
          { cle: 'A', res: resultA, stats: statsA, couleur: 'var(--sand, #d9a066)' },
          { cle: 'B', res: resultB, stats: statsB, couleur: 'var(--cyan-accent, #38bdf8)' },
        ].map(({ cle, res, stats, couleur }) => (
          <Box key={cle}>
            <Typography
              variant="caption"
              sx={{ display: 'block', px: 0.5, fontWeight: 700, color: couleur }}
            >
              {`${cle} · ${res.datasetLabel || res.label}`}
            </Typography>
            <StatsBar stats={stats} />
          </Box>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, px: 0.5 }}>
        {t('explore.curtain.hint')}
      </Typography>
    </Box>
  );
}
