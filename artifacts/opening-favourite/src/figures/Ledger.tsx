import { X, type Scenario } from '@/data/exhibits';
import { Figure, linear, cents, pct, usd, SERIES_1, INK } from './kit';

/** One average share on a 100-cent ruler, with a magnified view of the few cents that matter. */
export function LedgerFigure({ scenario, onScenario }: { scenario: Scenario; onScenario: (s: Scenario) => void }) {
  const id = X.scenarios[scenario].identity;
  const feeShare = id.fees / id.shares;
  const frictionShare = id.friction / id.shares;
  const zoomLo = Math.floor(id.avg_price * 100 - 1) / 100;
  const zoomHi = Math.ceil(id.win_rate * 100 + 1) / 100;
  return (
    <Figure
      testId="figure-ledger"
      phoneHeight="26.5rem"
      title="The average share, cent by cent"
      sub={`${id.shares.toLocaleString('en-US')} shares bought. Each paid $1 if its side won and nothing otherwise.`}
      source={`Account totals, ${scenario} execution. Average payout per share equals the share-weighted win rate. Lines are rounded, so they can differ from a total by a cent.`}
      controls={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="tiles" style={{ flex: 1, minWidth: '16rem' }}>
            <div className="tile"><div className="k">Kept per dollar spent</div><div className="v">{pct(id.margin, 3)}</div></div>
            <div className="tile"><div className="k">Times the $1,000 was spent</div><div className="v">{id.turnover.toFixed(3)}×</div></div>
            <div className="tile"><div className="k">Return on the account</div><div className="v">{id.return_pct.toFixed(2)}%</div></div>
          </div>
          <div className="seg" role="group" aria-label="Execution assumptions">
            {(['normal', 'stressed'] as const).map((s) => (
              <button key={s} aria-pressed={scenario === s} onClick={() => onScenario(s)}>{s === 'normal' ? 'Normal' : 'Stressed'}</button>
            ))}
          </div>
        </div>
      }
    >
      {({ w, h: full, rem }) => {
        const narrow = w < 26 * rem;
        // The ledger table sits under the bars; on a narrow plate its first row wraps and it needs more room.
        const h = Math.max(11 * rem, full - (narrow ? 12.6 : 10.2) * rem);
        const l = 0.4 * rem, r = w - 0.4 * rem;
        const x = linear(0, 1, l, r);
        const z = linear(zoomLo, zoomHi, l, r);
        const bar = Math.min(2.6 * rem, h * 0.16);
        const top = Math.max(2.2 * rem, h * 0.14);
        const zTop = Math.min(h - bar - 3.4 * rem, top + bar + Math.max(4.2 * rem, h * 0.26));
        const gap = 2;
        const seg = (x0: number, x1: number, y: number, fill: string, opacity: number, cls = 'grow-right', delay = 0) => (
          <rect className={cls} style={{ animationDelay: `${delay}s` }} x={x0 + gap / 2} width={Math.max(0.5, x1 - x0 - gap)} y={y} height={bar} fill={fill} fillOpacity={opacity} />
        );
        const paid = id.avg_cost, won = id.win_rate;
        const tick = (px: number, y: number, label: string, anchor: 'start' | 'middle' | 'end' = 'middle', below = true) => (
          <g>
            <line x1={px} x2={px} y1={below ? y + bar : y - 0.35 * rem} y2={below ? y + bar + 0.35 * rem : y} stroke={INK} strokeWidth={1} opacity={0.5} />
            <text className="fig-tick fig-halo" x={px} y={below ? y + bar + 1.25 * rem : y - 0.6 * rem} textAnchor={anchor} fontSize={0.72 * rem}>{label}</text>
          </g>
        );
        const line = (name: string, per: number, total: number, sign: 1 | -1, strong = false) => (
          <tr style={strong ? { fontWeight: 650 } : undefined}>
            <td>{name}</td><td>{cents(per, 2)}</td><td>{sign < 0 ? '−' : ''}{usd(total)}</td>
          </tr>
        );
        return (
          <>
          <table className="figure-table" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: '.88rem' }}>
            <thead><tr><th>The account, line by line</th><th>Per share</th><th>Account total</th></tr></thead>
            <tbody>
              {line('Paid out on winning shares', id.win_rate, id.redemption, 1)}
              {line('Price paid', id.avg_price, id.principal, -1)}
              {line('Exchange fees', feeShare, id.fees, -1)}
              {line('Extra modeled cost', frictionShare, id.friction, -1)}
              {line('Kept', id.edge_per_share, id.net, 1, true)}
            </tbody>
          </table>
          <svg role="img" aria-label="Average cost and payout per share" style={{ height: h, bottom: 'auto' }}>
            {/* Whole share: 0 to 100 cents */}
            {seg(x(0), x(paid), top, INK, 0.32)}
            {seg(x(paid), x(won), top, SERIES_1, 1, 'grow-right', 0.25)}
            <rect x={x(won) + gap / 2} width={x(1) - x(won) - gap / 2} y={top} height={bar} fill="none" stroke={INK} strokeWidth={1} opacity={0.3} />
            <text className="fig-text" x={x(paid / 2)} y={top + bar / 2} dy="0.34em" textAnchor="middle" fontSize={0.84 * rem} fontWeight={600}>paid {cents(paid, 2)}</text>
            {!narrow && <text className="fig-muted" x={x((won + 1) / 2)} y={top + bar / 2} dy="0.34em" textAnchor="middle" fontSize={0.76 * rem}>lost {pct(1 - won)}</text>}
            <text className="fig-text" x={x((paid + won) / 2)} y={top - 0.6 * rem} textAnchor="middle" fontSize={0.84 * rem} fontWeight={650}>kept {cents(id.edge_per_share, 2)}</text>
            {tick(x(0), top, '0¢', 'start')}
            {tick(x(1), top, narrow ? '$1' : '$1 if it wins', 'end')}

            {/* Zoom connector */}
            <path d={`M${x(zoomLo)},${top + bar + 0.2 * rem}L${l},${zTop - 0.25 * rem}M${x(zoomHi)},${top + bar + 0.2 * rem}L${r},${zTop - 0.25 * rem}`} stroke={INK} strokeWidth={1} opacity={0.3} fill="none" />
            {/* Centred inside the funnel at mid-height, which also keeps it clear of the labels over the lower bar when the plate is short. */}
            <text className="fig-muted" x={(l + x(zoomLo) + r + x(zoomHi)) / 4} y={(top + bar + zTop) / 2} dy="0.3em" textAnchor="middle" fontSize={0.74 * rem}>the same share, magnified</text>

            {/* Magnified: price, fees, extra cost, kept */}
            {seg(z(zoomLo), z(id.avg_price), zTop, INK, 0.32, 'fade-in', 0.4)}
            {seg(z(id.avg_price), z(id.avg_price + feeShare), zTop, INK, 0.62, 'fade-in', 0.5)}
            {seg(z(id.avg_price + feeShare), z(paid), zTop, INK, 0.85, 'fade-in', 0.6)}
            {seg(z(paid), z(won), zTop, SERIES_1, 1, 'fade-in', 0.7)}
            <rect x={z(won) + gap / 2} width={z(zoomHi) - z(won) - gap / 2} y={zTop} height={bar} fill="none" stroke={INK} strokeWidth={1} opacity={0.3} />
            {tick(z(id.avg_price), zTop, `price ${cents(id.avg_price, 2)}`, 'end')}
            {tick(z(id.avg_price + feeShare / 2), zTop, `fees ${cents(feeShare, 2)}`, 'end', false)}
            {tick(z(paid - frictionShare / 2), zTop, `extra cost ${cents(frictionShare, 2)}`, 'start', false)}
            {tick(z(won), zTop, `payout ${cents(won, 2)}`, 'middle')}
            <text className="fig-text" x={z((paid + won) / 2)} y={zTop + bar / 2} dy="0.34em" textAnchor="middle" fontSize={0.86 * rem} fontWeight={650} fill="#fff" style={{ fill: '#fff' }}>
              kept {cents(id.edge_per_share, 2)}
            </text>
          </svg>
          </>
        );
      }}
    </Figure>
  );
}
