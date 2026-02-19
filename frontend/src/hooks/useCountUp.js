import { useRef, useEffect, useState } from 'react';

/* ═══ Hook countUp ═══ */
export function useCountUp(target, decimals = 0, delay = 0) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rafId = null;
    let timeoutId = null;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1800;
        timeoutId = setTimeout(() => {
          const t0 = performance.now();
          const tick = (now) => {
            const p = Math.min((now - t0) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setValue(parseFloat((eased * target).toFixed(decimals)));
            if (p < 1) rafId = requestAnimationFrame(tick);
            else setValue(target);
          };
          rafId = requestAnimationFrame(tick);
        }, delay * 1000);
        observer.disconnect();
      }
    }, { threshold: 0.5 });

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [target, decimals, delay]);

  return { ref, value };
}
