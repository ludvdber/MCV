import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Copie une URL dans le presse-papier avec retour visuel temporaire.
 * Remplace le pattern useState + navigator.clipboard + setTimeout repete dans toutes les pages.
 *
 * @returns {[boolean, (url: string) => void]}
 *   [copied, copyToClipboard]
 *   - copied          : true pendant ~2s apres une copie reussie
 *   - copyToClipboard : fonction a appeler avec l'URL a copier
 */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copyToClipboard = useCallback((url) => {
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopied(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }, []);
  return [copied, copyToClipboard];
}
