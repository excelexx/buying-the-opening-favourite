import { X } from '@/data/exhibits';
import { Figure, YAxis, linear, usd, SERIES_1, SERIES_2, INK } from './kit';

const LABEL: Record<number, string[]> = { 3: ['3 days', 'before'], 2: ['2 days', 'before'], 1: ['1 day', 'before'], 0: ['Voting', 'day'] };

/** Eight replays of the full period: four start days under two execution settings. */
export function RobustnessFigure() {
  const days = [3, 2, 1, 0];
  const pick = (scenario: 'normal' | 'stressed') => days.map((d) => X.start_days.find((r) => r.days === d && r.scenario === scenario)!);
  const series = [
    { name: 'Normal execution', color: SERIES_1, rows: pick('normal') },
    { name: 'Stressed execution', color: SERIES_2, rows: pick('stressed') },
  ];
  return (
    <Figure
      testId="figure-robustness"
      title="Eight versions of the same test"
      sub="Net profit over 2024 to 2026 when buying starts three, two, one or zero days before each vote. All eight are above zero, and they are far from equal."
      source="Each replay moves both the first observation and the first possible purchase; the buying end stays fixed."
      legend={series.map((s) => <span key={s.name}><i className="line" style={{ color: s.color }} />{s.name}</span>)}
      table={{
        head: ['Buying starts', 'Normal', 'Stressed', 'Markets bought, normal'],
        rows: days.map((d, i) => [LABEL[d]!.join(' '), usd(series[0]!.rows[i]!.net), usd(series[1]!.rows[i]!.net), series[0]!.rows[i]!.filled]),
      }}
    >
      {({ w, h, rem }, setTip) => {
        const m = { l: 3.2 * rem, r: 1 * rem, t: 1.5 * rem, b: 2.8 * rem };
        const band = (w - m.l - m.r) / days.length;
        const cx = (i: number) => m.l + band * (i + 0.5);
        const y = linear(0, 350, h - m.b, m.t);
        const y0 = h - m.b;
        const dot = Math.max(4.5, 0.32 * rem);
        return (
          <svg role="img" aria-label="Net profit by buying start day, normal and stressed execution">
            <YAxis ticks={[0, 100, 200, 300]} y={y} x0={m.l} x1={w - m.r} rem={rem} format={(v) => `$${v}`} />
            <line x1={m.l} x2={w - m.r} y1={y0} y2={y0} stroke={INK} strokeWidth={1.25} opacity={0.75} />
            {days.map((d, i) => LABEL[d]!.map((line, k) => (
              <text key={`${d}-${k}`} className="fig-tick" x={cx(i)} y={y0 + (1.15 + k * 1.05) * rem} textAnchor="middle" fontSize={0.72 * rem}>{line}</text>
            )))}
            {series.map((s, k) => (
              <g key={s.name}>
                <path d={s.rows.map((r, i) => `${i ? 'L' : 'M'}${cx(i)},${y(r.net)}`).join('')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="draw" />
                {s.rows.map((r, i) => (
                  <g key={r.days} className="fade-in" style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
                    <circle cx={cx(i)} cy={y(r.net)} r={dot} fill={s.color} stroke="var(--plate)" strokeWidth={2} />
                    <text className="fig-text fig-halo" x={cx(i)} y={y(r.net) + (k === 0 ? -0.8 : 1.55) * rem} textAnchor="middle" fontSize={0.8 * rem} fontWeight={600}>{usd(r.net)}</text>
                  </g>
                ))}
              </g>
            ))}
            {days.map((d, i) => (
              <rect key={d} className="fig-hit" tabIndex={0} x={m.l + band * i} width={band} y={m.t} height={Math.max(0, y0 - m.t)}
                aria-label={`${LABEL[d]!.join(' ')}: normal ${usd(series[0]!.rows[i]!.net)}, stressed ${usd(series[1]!.rows[i]!.net)}`}
                onPointerMove={() => setTip({ x: cx(i), y: y(series[0]!.rows[i]!.net) - rem, body: (
                  <>
                    <div>Start {LABEL[d]!.join(' ').toLowerCase()}</div>
                    <div><b>{usd(series[0]!.rows[i]!.net)}</b> normal</div>
                    <div><b>{usd(series[1]!.rows[i]!.net)}</b> stressed</div>
                  </>) })} />
            ))}
          </svg>
        );
      }}
    </Figure>
  );
}
