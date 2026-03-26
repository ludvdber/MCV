import { useCallback } from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';

/**
 * Toast provider using sonner (5 KB, zero-config).
 * Replaces the previous custom Snackbar-based implementation.
 * Theme-aware: adapts to dark/light mode via data-theme attribute.
 */
export function ToastProvider({ children }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--glass-border)',
            fontFamily: 'var(--font-body)',
          },
        }}
      />
    </>
  );
}

/**
 * Hook pour afficher un toast depuis n'importe quel composant.
 * API compatible avec l'ancien useToast: showToast(message, severity?, duration?)
 * Returns a stable function reference (memoized).
 * @returns {(message: string, severity?: string, duration?: number) => void}
 */
export function useToast() {
  return useCallback((message, severity = 'success', duration = 3000) => {
    const opts = { duration };
    switch (severity) {
      case 'error':   sonnerToast.error(message, opts); break;
      case 'warning': sonnerToast.warning(message, opts); break;
      case 'info':    sonnerToast.info(message, opts); break;
      default:        sonnerToast.success(message, opts); break;
    }
  }, []);
}
