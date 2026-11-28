import { X } from '@/data/exhibits';
import { Figure, XAxis, YAxis, linear, pct, SERIES_1, INK } from './kit';

/** Reliability diagram: the favourite's opening price against how often it won. */
export function CalibrationFigure() {
  const o = X.opening;
  const strong = o.buckets[3]!;
  const weak = o.buckets[0]!;
  return (
    <Figure
      testId="figure-calibration"
      title="Opening price against what happened"
      sub={`${o.settled} settled contracts, grouped by the favourite's opening price. A dot above the line won more often than it was priced.`}
      source="Opening price is the midpoint of the first usable quote after the buying window opens, three days before the vote. Whiskers are 95% Wilson intervals."
      table={{
        head: ['Opening price', 'Contracts', 'Average price', 'Won', 'Win rate', '95% interval'],
        rows: o.buckets.map((b) => [
          `${Math.round(b.lo * 100)} to ${Math.round(b.hi * 100)}%`, b.n, pct(b.mean_p), b.wins, pct(b.win_rate),
          `${pct(b.lo95, 0)} to ${pct(b.hi95, 0)}`,
        ]),
      }}
    >
      {({ w, h, rem }, setTip) => {
        const m = { l: 3 * rem, r: 1.1 * rem, t: 1.9 * rem, b: 4.5 * rem };
        const x = linear(0.5, 1, m.l, w - m.r);
        const y = linear(0.3, 1, h - m.b, m.t);
        const y0 = h - m.b;
        const dot = Math.max(4.5, 0.32 * rem);
        return (
          <svg role="img" aria-label="Win rate of the opening favourite by opening price bucket">
            <YAxis ticks={[0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]} y={y} x0={m.l} x1={w - m.r} rem={rem} format={(v) => pct(v, 0)} />
            <XAxis ticks={[0.5, 0.6, 0.7, 0.8, 0.9, 1]} x={x} y0={y0} x0={m.l} x1={w - m.r} rem={rem} format={(v) => pct(v, 0)} />
            <text className="fig-muted" x={0} y={y0 + 2.5 * rem} fontSize={0.72 * rem}>Contracts</text>
            {o.buckets.map((b) => (
              <text key={b.lo} className="fig-tick" x={x(b.mean_p)} y={y0 + 2.5 * rem} textAnchor="middle" fontSize={0.72 * rem}>{b.n}</text>
            ))}
            <text className="fig-muted" x={(m.l + w - m.r) / 2} y={y0 + 3.85 * rem} textAnchor="middle" fontSize={0.76 * rem}>Favourite's opening price</text>
            <text className="fig-muted" x={0} y={m.t - 1 * rem} fontSize={0.76 * rem}>Share of contracts that won</text>

            <line x1={x(0.5)} y1={y(0.5)} x2={x(1)} y2={y(1)} stroke={INK} strokeWidth={1.25} opacity={0.6} />
            {/* Key, set in the empty corner under the line */}
            {w > 34 * rem && <g transform={`translate(${x(0.735)},${y(0.47)})`}>
              <line x1={0} x2={1.5 * rem} y1={0} y2={0} stroke={INK} strokeWidth={1.25} opacity={0.6} />
              <text className="fig-muted" x={2 * rem} y={0} dy="0.32em" fontSize={0.74 * rem}>fair price: wins as often as priced</text>
              <line x1={0.75 * rem} x2={0.75 * rem} y1={0.95 * rem} y2={2.05 * rem} stroke={SERIES_1} strokeWidth={1.5} opacity={0.4} />
              <circle cx={0.75 * rem} cy={1.5 * rem} r={dot * 0.85} fill={SERIES_1} stroke="var(--plate)" strokeWidth={2} />
              <text className="fig-muted" x={2 * rem} y={1.5 * rem} dy="0.32em" fontSize={0.74 * rem}>a group of contracts, with its 95% interval</text>
            </g>}

            {o.buckets.map((b, i) => (
              <g key={b.lo} className="fade-in" style={{ animationDelay: `${0.15 + i * 0.09}s` }}>
                <line x1={x(b.mean_p)} x2={x(b.mean_p)} y1={y(b.lo95)} y2={y(b.hi95)} stroke={SERIES_1} strokeWidth={1.5} opacity={0.4} />
                <circle cx={x(b.mean_p)} cy={y(b.win_rate)} r={dot} fill={SERIES_1} stroke="var(--plate)" strokeWidth={2} />
              </g>
            ))}

            <g className="fade-in" style={{ animationDelay: '.8s' }}>
              <text className="fig-text" x={x(strong.mean_p) - 0.8 * rem} y={y(strong.win_rate) - 0.75 * rem} textAnchor="end" fontSize={0.8 * rem} fontWeight={600}>
                priced {pct(strong.mean_p, 0)}, won {pct(strong.win_rate, 0)}
              </text>
              <text className="fig-text" x={x(weak.mean_p) + 0.75 * rem} y={y(weak.win_rate) + 0.3 * rem} textAnchor="start" fontSize={0.8 * rem} fontWeight={600}>
                priced {pct(weak.mean_p, 0)}, won {pct(weak.win_rate, 0)}
              </text>
            </g>

            {o.buckets.map((b) => (
              <rect key={b.lo} className="fig-hit" tabIndex={0} x={x(b.lo)} width={x(b.hi) - x(b.lo)} y={m.t} height={Math.max(0, y0 - m.t)}
                aria-label={`Opening price ${Math.round(b.lo * 100)} to ${Math.round(b.hi * 100)} percent: ${b.wins} of ${b.n} won`}
                onPointerMove={() => setTip({ x: x(b.mean_p), y: y(b.win_rate), body: <Tip b={b} /> })}
                onFocus={() => setTip({ x: x(b.mean_p), y: y(b.win_rate), body: <Tip b={b} /> })}
                onBlur={() => setTip(null)} />
            ))}
          </svg>
        );
      }}
    </Figure>
  );
}

function Tip({ b }: { b: (typeof X.opening.buckets)[number] }) {
  return (
    <>
      <div><b>{b.wins} of {b.n}</b> won, {pct(b.win_rate)}</div>
      <div>priced {pct(b.mean_p)} on average</div>
      <div>95% interval {pct(b.lo95, 0)} to {pct(b.hi95, 0)}</div>
    </>
  );
}
