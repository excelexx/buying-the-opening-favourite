import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Slide } from '@/deck';

const EASE = [0.2, 0.7, 0.1, 1] as const;

/** The copy never shrinks below this share of its size. Past that it scrolls instead. */
const SMALLEST = 0.8;

/**
 * Keeps a chapter's copy inside its column. A browser window is shorter than the screen it sits on, so the
 * longest chapters can run a line or two past the bottom. Rather than hide a line on the day, the copy
 * is set a few per cent smaller: `--fit` drives `zoom` in the stylesheet, so the lines rewrap as they shrink.
 */
function useFit() {
  const box = useRef<HTMLElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const outer = box.current, el = inner.current;
    if (!outer || !el) return;
    let frame = 0;
    const fit = () => {
      el.style.removeProperty('--fit');
      // On a phone the chapter scrolls as a page, and small type would be worse than scrolling.
      if (!window.matchMedia('(min-width: 900px)').matches) return;
      for (let k = 0.98; outer.scrollHeight > outer.clientHeight + 1 && k > SMALLEST - 0.005; k -= 0.02) {
        el.style.setProperty('--fit', k.toFixed(2));
      }
    };
    const refit = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    fit();
    const watch = new ResizeObserver(refit);
    watch.observe(outer);
    watch.observe(el);
    void document.fonts?.ready.then(refit);
    return () => { watch.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return { box, inner };
}

/** The text half of a chapter. Shrinks slightly to fit a short window, and scrolls only if that is not enough. */
export function Copy({ ch, hero = false, children }: { ch: Slide; hero?: boolean; children: ReactNode }) {
  const right = ch.align === 'right';
  const { box, inner } = useFit();
  return (
    <motion.section
      ref={box}
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.16 } }}
      className={`presentation-copy ${ch.wide ? 'presentation-copy-wide' : ''} ${right ? 'copy-right' : 'copy-left'}`}
      data-testid={`section-${ch.id}`}>
      <div className="copy-inner" ref={inner}>
        <h1 className={`chapter-title ${hero ? 'chapter-title-hero' : ''}`}>{ch.title}</h1>
        {children}
      </div>
    </motion.section>
  );
}

/** The framed half of a figure chapter. Scene chapters use the shared 3D plate instead. */
export function Plate({ ch, children }: { ch: Slide; children: ReactNode }) {
  const right = ch.align === 'right';
  return (
    <motion.aside
      initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.38, ease: EASE } }} exit={{ opacity: 0, transition: { duration: 0.16 } }}
      className={`presentation-exhibit ${ch.wide ? 'presentation-exhibit-narrow' : ''} ${right ? 'exhibit-left' : 'exhibit-right'}`}
      style={{ zIndex: 14 }}>
      {children}
    </motion.aside>
  );
}

export const Lead = ({ children }: { children: ReactNode }) => <p className="lead">{children}</p>;
export const Foot = ({ children }: { children: ReactNode }) => <p className="foot-note">{children}</p>;
export const Takeaway = ({ children }: { children: ReactNode }) => <p className="takeaway">{children}</p>;

export function Tiles({ items }: { items: { k: string; v: string; d?: string }[] }) {
  return (
    <div className="tiles" style={{ marginTop: '1.1rem' }}>
      {items.map((t) => (
        <div className="tile" key={t.k}>
          <div className="k">{t.k}</div>
          <div className="v">{t.v}</div>
          {t.d && <div className="d">{t.d}</div>}
        </div>
      ))}
    </div>
  );
}
