import { X, NORMAL } from '@/data/exhibits';
import { Figure, XAxis, YAxis, linear, usd, SERIES_1, INK } from './kit';

export const sdAt = (rho: number) => Math.sqrt(NORMAL.risk.own_variance + rho * NORMAL.risk.same_night_cross);
export const zAt = (rho: number) => (NORMAL.risk.net - NORMAL.risk.null_mean) / sdAt(rho);
/** Independent-bet equivalent of n equal bets that share pairwise correlation rho. */
export const effective = (n: number, rho: number) => n / (1 + (n - 1) * rho);

/** How fast correlation between same-night contracts erodes the evidence. */
export function CorrelationFigure({ rho, onRho }: { rho: number; onRho: (r: number) => void }) {
  const night = X.opening.largest_nights[0]!;
  const measured = X.opening.same_night_corr;
  const nullHi = X.opening.same_night_null_hi;
  return (
    <Figure
      testId="figure-correlation"
      title="How surprising is the profit, if prices were fair?"
      sub="Standard deviations between our profit and what a fair market would have paid, as the correlation between same-night contracts rises."
      source={`Model: each of ${NORMAL.positions.settled} settled positions is one weighted coin, and every same-night pair shares one correlation. A fair market expects a loss equal to fees and costs, ${usd(NORMAL.risk.null_mean)}. Estimate: intraclass correlation of standardized surprises, ${X.opening.settled} opening prices.`}
      table={{
        head: ['Correlation', 'Std. dev. of profit', 'Std. devs above fair', `${night} contracts count as`],
        rows: [0, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5].map((r) => [r.toFixed(2), usd(sdAt(r), 0), zAt(r).toFixed(2), `${effective(night, r).toFixed(1)} bets`]),
      }}
      controls={
        <>
          <div className="dial">
            <label htmlFor="rho-dial">Same-night correlation</label>
            <input id="rho-dial" className="dial-range" data-tone="yes" type="range" onPointerUp={(e) => e.currentTarget.blur()} min={0} max={0.5} step={0.005} value={rho}
              onChange={(e) => onRho(Number(e.target.value))} data-testid="input-rho" />
            <output>{rho.toFixed(3)}</output>
          </div>
          <div className="tiles">
            <div className="tile"><div className="k">Std. dev. of profit</div><div className="v">{usd(sdAt(rho), 0)}</div></div>
            <div className="tile"><div className="k">Profit is above fair by</div><div className="v">{zAt(rho).toFixed(2)} sd</div></div>
            <div className="tile"><div className="k">{night} contracts on one night count as</div><div className="v">{effective(night, rho).toFixed(rho < 0.002 ? 0 : 1)} bets</div></div>
          </div>
        </>
      }
    >
      {({ w, h, rem }) => {
        const m = { l: 2.6 * rem, r: 1.1 * rem, t: 0.9 * rem, b: 2.9 * rem };
        const x = linear(0, 0.5, m.l, w - m.r);
        const y = linear(0, 2, h - m.b, m.t);
        const y0 = h - m.b;
        const pts = Array.from({ length: 101 }, (_, i) => i * 0.005);
        const line = pts.map((r, i) => `${i ? 'L' : 'M'}${x(r)},${y(zAt(r))}`).join('');
        const dot = Math.max(5, 0.36 * rem);
        return (
          <svg role="img" aria-label="Standard deviations above a fair market as correlation rises">
            <YAxis ticks={[0, 0.5, 1, 1.5, 2]} y={y} x0={m.l} x1={w - m.r} rem={rem} format={(v) => v.toFixed(1)} />
            <XAxis ticks={[0, 0.1, 0.2, 0.3, 0.4, 0.5]} x={x} y0={y0} x0={m.l} x1={w - m.r} rem={rem} format={(v) => v.toFixed(1)} label="Correlation between contracts decided on the same night" />
            <line x1={m.l} x2={w - m.r} y1={y(1.645)} y2={y(1.645)} stroke={INK} strokeWidth={1} opacity={0.55} />
            <text className="fig-muted" x={w - m.r} y={y(1.645) - 0.45 * rem} textAnchor="end" fontSize={0.74 * rem}>the usual bar for "unlikely to be luck" (1 in 20)</text>
            <path d={`${line}L${x(0.5)},${y(0)}L${x(0)},${y(0)}Z`} fill={SERIES_1} opacity={0.1} />
            <path d={line} fill="none" stroke={SERIES_1} strokeWidth={2} strokeLinejoin="round" pathLength={1} className="draw" />
            <g className="fade-in" style={{ animationDelay: '.9s' }}>
              <rect x={x(0)} width={x(nullHi) - x(0)} y={m.t} height={Math.max(0, y0 - m.t)} fill={INK} opacity={0.06} />
              <text className="fig-muted" x={x(nullHi) + 0.5 * rem} y={y0 - 0.6 * rem} fontSize={0.74 * rem}>shuffled dates reach {nullHi.toFixed(2)}</text>
              <line x1={x(measured)} x2={x(measured)} y1={y(zAt(measured))} y2={y(zAt(measured)) - 1.7 * rem} stroke={INK} strokeWidth={1} opacity={0.5} />
              <circle cx={x(measured)} cy={y(zAt(measured))} r={dot * 0.8} fill={INK} stroke="var(--plate)" strokeWidth={2} />
              <text className="fig-text" x={x(measured) + 0.2 * rem} y={y(zAt(measured)) - 2.1 * rem} fontSize={0.78 * rem} fontWeight={600}>our estimate, {measured.toFixed(2)}</text>
            </g>
            <line x1={x(rho)} x2={x(rho)} y1={y(zAt(rho))} y2={y0} stroke={SERIES_1} strokeWidth={1.25} />
            <circle cx={x(rho)} cy={y(zAt(rho))} r={dot} fill={SERIES_1} stroke="var(--plate)" strokeWidth={2} />
          </svg>
        );
      }}
    </Figure>
  );
}
