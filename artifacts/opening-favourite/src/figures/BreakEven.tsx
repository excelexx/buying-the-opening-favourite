import { X, FRICTION, fee, type Scenario } from '@/data/exhibits';
import { Figure, XAxis, YAxis, linear, clamp, pct, cents, signedCents, SERIES_1, INK } from './kit';

export const bucketFor = (price: number) => X.opening.buckets.find((b) => price >= b.lo && price < b.hi) ?? X.opening.buckets[X.opening.buckets.length - 1]!;

/**
 * The hurdle a share must clear, and where the sample landed.
 * Everything is measured in cents per share relative to the price paid, so a fair market is the zero line.
 */
export function BreakEvenFigure({ price, onPrice, scenario, onScenario }: {
  price: number; onPrice: (p: number) => void; scenario: Scenario; onScenario: (s: Scenario) => void;
}) {
  const o = X.opening;
  const c = FRICTION[scenario];
  const hurdle = (p: number) => (fee(p) + c) * 100;
  const chosen = bucketFor(price);
  return (
    <Figure
      testId="figure-breakeven"
      title="The hurdle, and where the favourites landed"
      sub="Cents per share above the price paid. A fair market sits on the zero line. The shaded hump is what fees and extra costs take."
      source="Dots: win rate minus average opening ask, by opening price range, with 95% Wilson intervals. Curve: the standard 7% taker schedule plus the scenario's extra cost. Contracts from 2024 were fee-free."
      table={{
        head: ['Opening price', 'Contracts', 'Average ask', 'Win rate', 'Above the ask', 'Fees and costs', 'After costs'],
        rows: o.buckets.map((b) => [
          `${Math.round(b.lo * 100)} to ${Math.round(b.hi * 100)}%`, b.n, cents(b.mean_ask), pct(b.win_rate),
          signedCents(b.win_rate - b.mean_ask), cents(fee(b.mean_ask) + c, 2), signedCents(b.win_rate - b.mean_ask - fee(b.mean_ask) - c),
        ]),
      }}
      controls={
        <>
          <div className="dial">
            <label htmlFor="price-dial">Price paid</label>
            <input id="price-dial" className="dial-range" data-tone="yes" type="range" onPointerUp={(e) => e.currentTarget.blur()} min={0.5} max={0.99} step={0.01} value={price}
              onChange={(e) => onPrice(Number(e.target.value))} aria-valuetext={`${Math.round(price * 100)} cents`} data-testid="input-price" />
            <output>{Math.round(price * 100)}¢</output>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="tiles" style={{ flex: 1, minWidth: '16rem' }}>
              <div className="tile"><div className="k">Fee at this price</div><div className="v">{cents(fee(price), 2)}</div></div>
              <div className="tile"><div className="k">Must win</div><div className="v">{pct(price + fee(price) + c, 2)}</div></div>
              <div className="tile"><div className="k">Won in this range</div><div className="v">{pct(chosen.win_rate)}</div><div className="d">{chosen.wins} of {chosen.n} contracts</div></div>
            </div>
            <div className="seg" role="group" aria-label="Execution assumptions">
              {(['normal', 'stressed'] as const).map((s) => (
                <button key={s} aria-pressed={scenario === s} onClick={() => onScenario(s)}>{s === 'normal' ? 'Normal costs' : 'Stressed costs'}</button>
              ))}
            </div>
          </div>
        </>
      }
    >
      {({ w, h, rem }, setTip) => {
        const m = { l: 3.1 * rem, r: 1.1 * rem, t: 0.8 * rem, b: 2.9 * rem };
        const x = linear(0.5, 1, m.l, w - m.r);
        const lo = -25, hi = 15;
        const y = linear(lo, hi, h - m.b, m.t);
        const y0 = h - m.b;
        const dot = Math.max(4.5, 0.32 * rem);
        const curve = Array.from({ length: 51 }, (_, i) => 0.5 + i * 0.01);
        const area = `M${x(0.5)},${y(0)}` + curve.map((p) => `L${x(p)},${y(hurdle(p))}`).join('') + `L${x(1)},${y(0)}Z`;
        const line = curve.map((p, i) => `${i ? 'L' : 'M'}${x(p)},${y(hurdle(p))}`).join('');
        return (
          <svg role="img" aria-label="Break-even hurdle by price, with observed results by opening price range">
            <YAxis ticks={[-20, -10, 0, 10]} y={y} x0={m.l} x1={w - m.r} rem={rem} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}¢`} />
            <XAxis ticks={[0.5, 0.6, 0.7, 0.8, 0.9, 1]} x={x} y0={y0} x0={m.l} x1={w - m.r} rem={rem} format={(v) => `${Math.round(v * 100)}¢`} label="Price paid per share" />

            <rect x={x(chosen.lo)} width={x(chosen.hi) - x(chosen.lo)} y={m.t} height={Math.max(0, y0 - m.t)} fill={INK} opacity={0.045} />
            <line x1={m.l} x2={w - m.r} y1={y(0)} y2={y(0)} stroke={INK} strokeWidth={1.25} opacity={0.75} />
            <text className="fig-muted" x={m.l + 0.4 * rem} y={y(0) + 1.05 * rem} fontSize={0.74 * rem}>fair price</text>

            <path d={area} fill={INK} opacity={0.17} />
            <path d={line} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" pathLength={1} className="draw" />
            <text className="fig-text" x={x(0.505)} y={y(hurdle(0.505)) - 0.6 * rem} fontSize={0.76 * rem} fontWeight={600}>fees and costs</text>

            {o.buckets.map((b, i) => {
              const v = (b.win_rate - b.mean_ask) * 100;
              return (
                <g key={b.lo} className="fade-in" style={{ animationDelay: `${0.25 + i * 0.09}s` }} opacity={b === chosen ? 1 : 0.55}>
                  <line x1={x(b.mean_ask)} x2={x(b.mean_ask)} y1={y(clamp((b.lo95 - b.mean_ask) * 100, lo, hi))} y2={y(clamp((b.hi95 - b.mean_ask) * 100, lo, hi))}
                    stroke={SERIES_1} strokeWidth={1.5} opacity={0.45} />
                  <circle cx={x(b.mean_ask)} cy={y(v)} r={b === chosen ? dot * 1.25 : dot} fill={SERIES_1} stroke="var(--plate)" strokeWidth={2} />
                </g>
              );
            })}
            <text className="fig-text" x={x(chosen.mean_ask) + (chosen.mean_ask > 0.75 ? -0.8 : 0.8) * rem} y={y((chosen.win_rate - chosen.mean_ask) * 100) - 0.7 * rem}
              textAnchor={chosen.mean_ask > 0.75 ? 'end' : 'start'} fontSize={0.8 * rem} fontWeight={650}>
              {signedCents(chosen.win_rate - chosen.mean_ask)} above the ask
            </text>
            <line x1={x(price)} x2={x(price)} y1={m.t} y2={y0} stroke={SERIES_1} strokeWidth={1.25} />
            <circle cx={x(price)} cy={y(hurdle(price))} r={dot * 0.8} fill={INK} stroke="var(--plate)" strokeWidth={2} />

            {o.buckets.map((b) => {
              const tip = {
                x: x(b.mean_ask), y: y((b.win_rate - b.mean_ask) * 100),
                body: (
                  <>
                    <div><b>{signedCents(b.win_rate - b.mean_ask)}</b> per share before costs</div>
                    <div>won {pct(b.win_rate)}, asked {cents(b.mean_ask)}</div>
                    <div>after costs <b>{signedCents(b.win_rate - b.mean_ask - fee(b.mean_ask) - c)}</b></div>
                  </>
                ),
              };
              return (
                <rect key={b.lo} className="fig-hit" x={x(b.lo)} width={x(b.hi) - x(b.lo)} y={m.t} height={Math.max(0, y0 - m.t)}
                  onPointerMove={() => setTip(tip)} onClick={() => onPrice(Math.round(b.mean_ask * 100) / 100)} style={{ cursor: 'pointer' }} />
              );
            })}
          </svg>
        );
      }}
    </Figure>
  );
}
