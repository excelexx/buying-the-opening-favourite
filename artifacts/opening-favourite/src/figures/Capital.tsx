import { useMemo } from 'react';
import { NORMAL } from '@/data/exhibits';
import { Figure, YAxis, linear, usd, SERIES_1, SERIES_2, INK } from './kit';

const DAY = 86400;
const fmt = (ts: number) => new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const utc = (y: number, m: number, d = 1) => Date.UTC(y, m - 1, d) / 1000;

/** Realized equity and cash tied up in open positions, through the whole test. */
export function CapitalFigure() {
  const { series, peak_deployed, peak_day } = NORMAL.equity;
  const t0 = utc(2024, 10, 15), t1 = utc(2026, 12, 5);
  const firstPeak = useMemo(() => series.filter((p) => p[0] < utc(2025, 1)).reduce((a, b) => (b[2] > a[2] ? b : a)), [series]);
  return (
    <Figure
      testId="figure-capital"
      title="The same $1,000, spent and returned"
      sub="Cash tied up in open positions, and the account's realized equity. Positions are carried at cost until they settle."
      source="End-of-day values, normal execution. Realized equity is $1,000 plus the net result of every settled position."
      legend={<><span><i className="line" style={{ color: SERIES_1 }} />Realized equity</span><span><i className="line" style={{ color: SERIES_2 }} />Cash in open positions</span></>}
      table={{
        head: ['Day (UTC)', 'Realized equity', 'In open positions'],
        rows: series.map((p) => [fmt(p[0]), usd(p[1]), usd(p[2])]),
      }}
    >
      {({ w, h, rem }, setTip) => {
        const m = { l: 3.6 * rem, r: 1 * rem, t: 0.9 * rem, b: 2 * rem };
        const x = linear(t0, t1, m.l, w - m.r);
        const y = linear(0, 1500, h - m.b, m.t);
        const y0 = h - m.b;
        // Step-after paths: a value holds until the next day that changes it.
        const step = (k: 1 | 2) => {
          let d = `M${x(t0)},${y(k === 1 ? 1000 : 0)}`;
          let prev = k === 1 ? 1000 : 0;
          for (const p of series) { d += `L${x(p[0])},${y(prev)}L${x(p[0])},${y(p[k])}`; prev = p[k]; }
          return d + `L${x(series[series.length - 1]![0] + 12 * DAY)},${y(prev)}`;
        };
        const deployed = step(2);
        const ticks = [[2025, 1], [2025, 7], [2026, 1], [2026, 7]] as const;
        const nearest = (px: number) => {
          const t = t0 + ((px - m.l) / (w - m.l - m.r)) * (t1 - t0);
          let best = series[0]!;
          for (const p of series) { if (p[0] <= t) best = p; else break; }
          return best;
        };
        return (
          <svg role="img" aria-label="Realized equity and capital in open positions over time"
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const px = e.clientX - box.left;
              if (px < m.l || px > w - m.r) { setTip(null); return; }
              const p = nearest(px);
              setTip({ x: px, y: y(Math.max(p[1], p[2])), body: <><div>{fmt(p[0])}</div><div><b>{usd(p[1])}</b> realized equity</div><div><b>{usd(p[2])}</b> in open positions</div></> });
            }}>
            <YAxis ticks={[0, 500, 1000, 1500]} y={y} x0={m.l} x1={w - m.r} rem={rem} format={(v) => `$${v.toLocaleString('en-US')}`} />
            <line className="fig-axis" x1={m.l} x2={w - m.r} y1={y0} y2={y0} />
            {ticks.map(([yr, mo]) => (
              <text key={`${yr}-${mo}`} className="fig-tick" x={x(utc(yr, mo))} y={y0 + 1.15 * rem} textAnchor="middle" fontSize={0.72 * rem}>
                {mo === 1 ? `Jan ${yr}` : `Jul ${yr}`}
              </text>
            ))}
            <path d={`${deployed}L${x(t1)},${y(0)}L${x(t0)},${y(0)}Z`} fill={SERIES_2} opacity={0.1} />
            <path d={deployed} fill="none" stroke={SERIES_2} strokeWidth={2} strokeLinejoin="round" pathLength={1} className="draw" />
            <path d={step(1)} fill="none" stroke={SERIES_1} strokeWidth={2} strokeLinejoin="round" pathLength={1} className="draw" />
            <g className="fade-in" style={{ animationDelay: '1s' }}>
              <text className="fig-text fig-halo" x={x(firstPeak[0]) + 0.7 * rem} y={y(firstPeak[2]) + 1.3 * rem} fontSize={0.76 * rem} fontWeight={600}>{usd(firstPeak[2], 0)} in play</text>
              <text className="fig-muted fig-halo" x={x(firstPeak[0]) + 0.7 * rem} y={y(firstPeak[2]) + 2.35 * rem} fontSize={0.72 * rem}>5 Nov 2024 election</text>
              <line x1={x(peak_day) - 0.35 * rem} x2={x(peak_day) - 2.2 * rem} y1={y(peak_deployed)} y2={y(1395)} stroke={INK} strokeWidth={1} opacity={0.4} />
              <text className="fig-text fig-halo" x={x(peak_day) - 2.5 * rem} y={y(1430)} textAnchor="end" fontSize={0.76 * rem} fontWeight={600}>{usd(peak_deployed, 0)} in play</text>
              <text className="fig-muted fig-halo" x={x(peak_day) - 2.5 * rem} y={y(1430) + 1.05 * rem} textAnchor="end" fontSize={0.72 * rem}>3 Nov 2026 election</text>
            </g>
          </svg>
        );
      }}
    </Figure>
  );
}
