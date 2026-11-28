import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export const INK = '#1c2438';
export const SERIES_1 = '#d8402a';
export const SERIES_2 = '#008c9c';

export type Size = { w: number; h: number; rem: number };

/** Pixel size of an element plus the current root font size, so SVG text tracks the fluid type scale. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0, rem: 16 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 && s.rem === rem ? s : { w: r.width, h: r.height, rem }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener('resize', read);
    return () => { ro.disconnect(); window.removeEventListener('resize', read); };
  }, []);
  return [ref, size] as const;
}

export const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const usd = (v: number, digits = 2) => `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const signedUsd = (v: number, digits = 2) => `${v < 0 ? '−' : '+'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
export const cents = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}¢`;
export const signedCents = (v: number, digits = 1) => `${v < 0 ? '−' : '+'}${Math.abs(v * 100).toFixed(digits)}¢`;

export type Tip = { x: number; y: number; body: ReactNode } | null;

export type TableSpec = { head: string[]; rows: (string | number)[][] };

/**
 * A figure plate: title, the plot, and a foot line naming the source.
 * Every figure can flip to a table of the numbers it draws.
 */
export function Figure({ title, sub, source, table, controls, legend, children, testId, phoneHeight }: {
  title: string; sub?: ReactNode; source: ReactNode; table?: TableSpec; controls?: ReactNode; legend?: ReactNode;
  /** Height of the plot on a phone, where the figure sizes itself instead of filling a plate. */
  phoneHeight?: string;
  children: (size: Size, setTip: (t: Tip) => void) => ReactNode; testId?: string;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const [asTable, setAsTable] = useState(false);
  useEffect(() => { setTip(null); }, [asTable]);
  return (
    <figure className="figure" data-testid={testId}>
      <div className="figure-head">
        <figcaption>
          <div className="figure-title">{title}</div>
          {sub && <div className="figure-sub">{sub}</div>}
        </figcaption>
        {table && (
          <button className="figure-toggle" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? 'Show chart' : 'Show table'}
          </button>
        )}
      </div>
      {legend && !asTable && <div className="legend" style={{ marginTop: '.5rem' }}>{legend}</div>}
      <div className="figure-body" ref={ref} onPointerLeave={() => setTip(null)} style={phoneHeight ? ({ '--body-h': phoneHeight } as CSSProperties) : undefined}>
        {asTable && table ? (
          <div className="figure-table-wrap">
            <table className="figure-table">
              <thead><tr>{table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ) : size.w > 0 && children(size, setTip)}
        {tip && !asTable && <div className="fig-tip" style={{ left: clamp(tip.x, 70, size.w - 70), top: Math.max(tip.y, 44) }}>{tip.body}</div>}
      </div>
      {controls && !asTable && <div className="figure-controls">{controls}</div>}
      <div className="figure-foot"><span>{source}</span></div>
    </figure>
  );
}

/** Left axis ticks with hairline grid. */
export function YAxis({ ticks, y, x0, x1, rem, format }: {
  ticks: number[]; y: (v: number) => number; x0: number; x1: number; rem: number; format: (v: number) => string;
}) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line className="fig-grid" x1={x0} x2={x1} y1={y(t)} y2={y(t)} />
          <text className="fig-tick" x={x0 - 0.45 * rem} y={y(t)} dy="0.32em" textAnchor="end" fontSize={0.72 * rem}>{format(t)}</text>
        </g>
      ))}
    </g>
  );
}

export function XAxis({ ticks, x, y0, rem, format, label, x0, x1 }: {
  ticks: number[]; x: (v: number) => number; y0: number; rem: number; format: (v: number) => string; label?: string; x0: number; x1: number;
}) {
  return (
    <g>
      <line className="fig-axis" x1={x0} x2={x1} y1={y0} y2={y0} />
      {ticks.map((t) => (
        <text key={t} className="fig-tick" x={x(t)} y={y0 + 1.15 * rem} textAnchor="middle" fontSize={0.72 * rem}>{format(t)}</text>
      ))}
      {label && <text className="fig-muted" x={(x0 + x1) / 2} y={y0 + 2.35 * rem} textAnchor="middle" fontSize={0.76 * rem}>{label}</text>}
    </g>
  );
}

/** A bar with a rounded data end and a square baseline end. */
export function barPath(x: number, w: number, yBase: number, yTip: number, r = 3) {
  const up = yTip < yBase;
  const rr = Math.min(r, w / 2, Math.abs(yBase - yTip));
  if (Math.abs(yBase - yTip) < 0.5) return `M${x},${yBase}h${w}`;
  return up
    ? `M${x},${yBase}V${yTip + rr}Q${x},${yTip} ${x + rr},${yTip}H${x + w - rr}Q${x + w},${yTip} ${x + w},${yTip + rr}V${yBase}Z`
    : `M${x},${yBase}V${yTip - rr}Q${x},${yTip} ${x + rr},${yTip}H${x + w - rr}Q${x + w},${yTip} ${x + w},${yTip - rr}V${yBase}Z`;
}

export function hbarPath(x0: number, x1: number, y: number, h: number, r = 3) {
  const right = x1 > x0;
  const rr = Math.min(r, h / 2, Math.abs(x1 - x0));
  if (Math.abs(x1 - x0) < 0.5) return `M${x0},${y}v${h}`;
  return right
    ? `M${x0},${y}H${x1 - rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 - rr},${y + h}H${x0}Z`
    : `M${x0},${y}H${x1 + rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 + rr},${y + h}H${x0}Z`;
}
