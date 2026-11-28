import type { ReactNode } from 'react';
import { YAxis, linear, barPath, signedUsd, SERIES_1, INK, type Size, type Tip } from './kit';

export type Column = {
  key: string;
  /** Category label, one entry per line. */
  label: string[];
  value: number;
  /** Print the value at the bar's tip. */
  show?: boolean;
  /** A second line under the value label. */
  note?: string;
  tip: ReactNode;
  aria: string;
};

/** Gains rise in vermilion, losses fall in ink, from one zero baseline. */
export function Columns({ cols, size, setTip, ticks, format = (v) => signedUsd(v, 0) }: {
  cols: Column[]; size: Size; setTip: (t: Tip) => void; ticks: number[]; format?: (v: number) => string;
}) {
  const { w, h, rem } = size;
  const lines = Math.max(...cols.map((c) => c.label.length));
  const m = { l: 3.4 * rem, r: 0.6 * rem, t: 1.5 * rem, b: (0.6 + lines * 1.05) * rem };
  const lo = Math.min(0, ...ticks), hi = Math.max(0, ...ticks);
  const y = linear(lo, hi, h - m.b, m.t);
  const band = (w - m.l - m.r) / cols.length;
  const bar = Math.min((cols.length <= 2 ? 3.2 : cols.length <= 5 ? 2.4 : 1.75) * rem, band * 0.62);
  const base = y(0);
  // Skip category labels that would run into their neighbours.
  const widest = Math.max(...cols.flatMap((c) => c.label.map((l) => l.length)));
  const labelStep = Math.max(1, Math.ceil(((widest * 0.4 + 0.7) * rem) / band));
  return (
    <svg role="img" aria-label="Net profit by category">
      <YAxis ticks={ticks} y={y} x0={m.l} x1={w - m.r} rem={rem} format={(v) => (v === 0 ? '$0' : format(v))} />
      {cols.map((c, i) => {
        const cx = m.l + band * (i + 0.5);
        const tipY = y(c.value);
        const up = c.value >= 0;
        // A label on the first or last of many bars would spill past the plot, so it hangs inward instead.
        const edge = cols.length > 6 ? (i === 0 ? 'start' : i === cols.length - 1 ? 'end' : 'middle') : 'middle';
        const anchor = edge as 'start' | 'middle' | 'end';
        const lx = anchor === 'start' ? cx - bar / 2 : anchor === 'end' ? cx + bar / 2 : cx;
        return (
          <g key={c.key}>
            <path className={up ? 'grow-up' : 'grow-down'} style={{ animationDelay: `${0.08 + i * (0.5 / cols.length)}s` }}
              d={barPath(cx - bar / 2, bar, base, tipY)} fill={up ? SERIES_1 : INK} opacity={up ? 1 : 0.78} />
            {c.show && (
              <g className="fade-in" style={{ animationDelay: '.7s' }}>
                <text className="fig-text" x={lx} y={up ? tipY - (c.note ? 1.5 : 0.45) * rem : tipY + 1.05 * rem} textAnchor={anchor} fontSize={0.84 * rem} fontWeight={650}>
                  {signedUsd(c.value)}
                </text>
                {c.note && <text className="fig-muted" x={lx} y={up ? tipY - 0.45 * rem : tipY + 2.1 * rem} textAnchor={anchor} fontSize={0.72 * rem}>{c.note}</text>}
              </g>
            )}
            {i % labelStep === 0 && c.label.map((line, k) => (
              <text key={k} className="fig-tick" x={cx} y={h - m.b + (1.15 + k * 1.05) * rem} textAnchor="middle" fontSize={0.72 * rem}>{line}</text>
            ))}
            <rect className="fig-hit" tabIndex={0} x={m.l + band * i} width={band} y={m.t - 1.2 * rem} height={Math.max(0, h - m.b - m.t + 1.2 * rem)} aria-label={c.aria}
              onPointerMove={() => setTip({ x: cx, y: Math.min(tipY, base), body: c.tip })}
              onFocus={() => setTip({ x: cx, y: Math.min(tipY, base), body: c.tip })} onBlur={() => setTip(null)} />
          </g>
        );
      })}
      <line x1={m.l} x2={w - m.r} y1={base} y2={base} stroke={INK} strokeWidth={1.25} opacity={0.75} pointerEvents="none" />
    </svg>
  );
}
