/*
 * Applique le thème avant le premier paint : évite le flash clair/sombre.
 * Chargé en <script> synchrone (bloquant) en tête de <head> depuis index.html.
 *
 * Fichier externe et non script inline : la CSP de production
 * (SecurityHeadersFilter, script-src 'self') bloque les scripts inline —
 * un hash sha256 dans la CSP casserait au moindre octet modifié ici.
 *
 * Aligné sur MUI cssVariables (attribut data-theme) et le mode par défaut « dark ».
 */
(function () {
  try {
    var m = localStorage.getItem('mcv-theme-mode') || 'dark';
    if (m === 'system') {
      m = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', m);
    if (localStorage.getItem('mcv-high-contrast') === 'true') {
      document.documentElement.setAttribute('data-contrast', 'high');
    }
  } catch (e) { /* localStorage indisponible : on garde le défaut CSS (dark) */ }
})();
