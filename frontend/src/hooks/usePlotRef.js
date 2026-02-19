import { useRef, useMemo } from 'react';

/**
 * Fournit un ref sur le conteneur du viewer et un ref synthetique sur l'element Plotly.
 * Remplace le pattern useRef + useMemo repete dans toutes les pages de visualisation.
 *
 * @returns {[React.RefObject, {current: Element|null}]}
 *   [viewerContainerRef, exportPlotRef]
 *   - viewerContainerRef : a passer sur <Box ref={viewerContainerRef}>
 *   - exportPlotRef      : a passer a <ExportMenu plotRef={exportPlotRef}>
 */
export function usePlotRef() {
  const viewerContainerRef = useRef(null);
  const exportPlotRef = useMemo(() => ({
    get current() {
      return viewerContainerRef.current?.querySelector('.js-plotly-plot') || null;
    }
  }), []);
  return [viewerContainerRef, exportPlotRef];
}
