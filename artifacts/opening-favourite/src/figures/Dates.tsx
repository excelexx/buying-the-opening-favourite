import { NORMAL, longDate, shortDate } from '@/data/exhibits';
import { Figure, YAxis, XAxis, linear, pct, signedUsd, usd, barPath, SERIES_1, INK } from './kit';
import { Columns, type Column } from './Columns';

export type DateView = 'dates' | 'resampled';

/** Profit by voting date, and the spread of totals when whole dates are redrawn. */
export function DatesFigure({ view, onView }: { view: DateView; onView: (v: DateView) => void }) {
  const r = NORMAL.risk;
  const active = NORMAL.dates.filter((d) => d.shares > 0);
  const worst = active.reduce((a, b) => (b.net < a.net ? b : a));
  const cols: Column[] = active.map((d) => ({
    key: d.date, label: [shortDate(d.date)], value: d.net,
    show: d.date === r.top_date || d.date === worst.date,
    note: d.date === r.top_date ? `${pct(r.top_date_share, 0)} of all profit` : undefined,
    tip: (
      <>
        <div>{longDate(d.date)}</div>
        <div><b>{signedUsd(d.net)}</b> net</div>
        <div>{d.filled} of {d.scheduled} scheduled markets bought</div>
        <div>{usd(d.cost)} spent</div>
      </>
    ),
    aria: `${longDate(d.date)}: ${signedUsd(d.net)} net`,
  }));
  const hist = r.boot_hist;
  return (
    <Figure
      testId="figure-dates"
      title={view === 'dates' ? `${r.active_dates} voting dates with purchases` : 'Redrawing the voting dates'}
      sub={view === 'dates'
        ? `${r.winning_dates} dates made money and ${r.losing_dates} lost. One presidential election night carries more than half of the total.`
        : `Total profit in ${r.boot_draws.toLocaleString('en-US')} redraws of the 52 voting dates, each date drawn whole and with replacement.`}
      source={view === 'dates'
        ? 'Net profit per voting date, normal execution. Dates with no purchases are omitted.'
        : `Bootstrap over voting dates. ${pct(r.boot_share_positive, 0)} of redraws end above zero; the middle 90% run from ${usd(r.boot_lo, 0)} to ${usd(r.boot_hi, 0)}.`}
      table={view === 'dates'
        ? { head: ['Voting date', 'Scheduled', 'Bought', 'Spent', 'Net'], rows: active.map((d) => [longDate(d.date), d.scheduled, d.filled, usd(d.cost), signedUsd(d.net)]) }
        : { head: ['Total profit from', 'to', 'Redraws'], rows: hist.counts.map((c, i) => [usd(hist.start + i * hist.width, 0), usd(hist.start + (i + 1) * hist.width, 0), c]) }}
      controls={
        <div className="seg" role="group" aria-label="View" style={{ justifySelf: 'start' }}>
          {([['dates', 'By voting date'], ['resampled', 'Redrawn 20,000 times']] as const).map(([k, label]) => (
            <button key={k} aria-pressed={view === k} onClick={() => onView(k)} data-testid={`button-dates-${k}`}>{label}</button>
          ))}
        </div>
      }
    >
      {(size, setTip) => {
        if (view === 'dates') return <Columns key="dates" cols={cols} size={size} setTip={setTip} ticks={[-150, -100, -50, 0, 50, 100, 150, 200]} />;
        const { w, h, rem } = size;
        const m = { l: 3.2 * rem, r: 1 * rem, t: 1.6 * rem, b: 2.9 * rem };
        const lo = -500, hi = 1200;
        const x = linear(lo, hi, m.l, w - m.r);
        const top = Math.max(...hist.counts);
        const y = linear(0, top * 1.08, h - m.b, m.t);
        const y0 = h - m.b;
        const bw = x(hist.width) - x(0);
        return (
          <svg key="resampled" role="img" aria-label="Distribution of total profit when voting dates are resampled">
            <YAxis ticks={[0, 500, 1000, 1500].filter((t) => t <= top * 1.08)} y={y} x0={m.l} x1={w - m.r} rem={rem} format={(v) => v.toLocaleString('en-US')} />
            <XAxis ticks={[-400, 0, 400, 800, 1200]} x={x} y0={y0} x0={m.l} x1={w - m.r} rem={rem} format={(v) => (v < 0 ? `−$${-v}` : `$${v}`)} label="Total profit in the redrawn account" />
            {hist.counts.map((c, i) => {
              const v0 = hist.start + i * hist.width;
              if (v0 < lo || v0 >= hi || !c) return null;
              const gain = v0 >= 0;
              return (
                <g key={i}>
                  <path className="grow-up" style={{ animationDelay: `${0.05 + (i / hist.counts.length) * 0.5}s` }}
                    d={barPath(x(v0) + 1, bw - 2, y0, y(c), 2)} fill={gain ? SERIES_1 : INK} opacity={gain ? 0.9 : 0.72} />
                  <rect className="fig-hit" x={x(v0)} width={bw} y={m.t} height={Math.max(0, y0 - m.t)}
                    onPointerMove={() => setTip({ x: x(v0) + bw / 2, y: y(c), body: <><div><b>{c.toLocaleString('en-US')}</b> redraws</div><div>{usd(v0, 0)} to {usd(v0 + hist.width, 0)}</div></> })} />
                </g>
              );
            })}
            <g className="fade-in" style={{ animationDelay: '.8s' }} pointerEvents="none">
              <line x1={x(r.net)} x2={x(r.net)} y1={m.t - 0.3 * rem} y2={y0} stroke={INK} strokeWidth={1.5} />
              <text className="fig-text" x={x(r.net) + 0.5 * rem} y={m.t + 0.3 * rem} fontSize={0.8 * rem} fontWeight={650}>actual {usd(r.net)}</text>
              <text className="fig-text" x={x(-480)} y={m.t + 0.3 * rem} fontSize={0.8 * rem} fontWeight={600}>{pct(1 - r.boot_share_positive, 0)} lose money</text>
            </g>
          </svg>
        );
      }}
    </Figure>
  );
}
