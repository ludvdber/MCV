import { m } from 'framer-motion';

/**
 * Wraps a page in a subtle fade-in transition.
 * Uses `m` (lazy) instead of `motion` to leverage LazyMotion (saves ~29 KB).
 * No exit animation — instant page switch, smooth entrance only.
 */
export default function PageTransition({ children }) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  );
}
