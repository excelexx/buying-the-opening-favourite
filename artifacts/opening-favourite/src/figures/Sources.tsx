import { NORMAL, STRESSED, type Cell } from '@/data/exhibits';
import { Figure, cents, pct, signedUsd, usd } from './kit';
import { Columns, type Column } from './Columns';

export type SourceView = 'anchor' | 'day' | 'price';
const DAY_LABEL: Record<number, string[]> = {
  [-3]: ['3 days', 'before'], [-2]: ['2 days', 'before'], [-1]: ['1 day', 'before'], 0: ['Voting', 'day'], 1: ['Day', 'after'],
};

function tip(name: string, c: Cell) {
  return (
    <>
      <div>{name}</div>
      <div><b>{signedUsd(c.net)}</b> net</div>
      <div>{Math.round(c.shares).toLocaleString('en-US')} shares at {cents(c.avg_cost)} all in</div>
      <div>{pct(c.win_rate)} of those shares won</div>
    </>
  );
}

/** The same account profit, cut three ways. */
export function SourcesFigure({ view, onView }: { view: SourceView; onView: (v: SourceView) => void }) {
  const f = NORMAL.fills;
  const s = STRESSED.fills;
  const col = (key: string, label: string[], c: Cell, show = true, note?: string): Column => ({
    key, label, value: c.net, show, note, tip: tip(label.join(' '), c),
    aria: `${label.join(' ')}: ${signedUsd(c.net)} net on ${Math.round(c.shares)} shares`,
  });
  const views: Record<SourceView, { cols: Column[]; ticks: number[]; sub: string; rows: (string | number)[][] }> = {
    anchor: {
      cols: [
        col('below', ['Bought below the', 'opening midpoint'], f.by_anchor.below, true, `${cents(f.by_anchor.below.avg_cost)} paid, ${pct(f.by_anchor.below.win_rate)} won`),
        col('above', ['Bought at or above', 'the opening midpoint'], f.by_anchor.at_or_above, true, `${cents(f.by_anchor.at_or_above.avg_cost)} paid, ${pct(f.by_anchor.at_or_above.win_rate)} won`),
      ],
      ticks: [-200, -100, 0, 100, 200, 300, 400, 500],
      sub: 'Every simulated fill, sorted by whether its price was under the chosen side\'s first quoted midpoint.',
      rows: [
        ['Below the opening midpoint', Math.round(f.by_anchor.below.shares), cents(f.by_anchor.below.avg_cost), pct(f.by_anchor.below.win_rate), signedUsd(f.by_anchor.below.net), signedUsd(s.by_anchor.below.net)],
        ['At or above it', Math.round(f.by_anchor.at_or_above.shares), cents(f.by_anchor.at_or_above.avg_cost), pct(f.by_anchor.at_or_above.win_rate), signedUsd(f.by_anchor.at_or_above.net), signedUsd(s.by_anchor.at_or_above.net)],
      ],
    },
    day: {
      cols: f.by_day.map((d) => col(String(d.day), DAY_LABEL[d.day] ?? [String(d.day)], d)),
      ticks: [-100, 0, 100, 200],
      sub: 'By the UTC day of each fill, counted from the contract\'s own voting date. The day after begins as eastern polls close.',
      rows: f.by_day.map((d, i) => [(DAY_LABEL[d.day] ?? [String(d.day)]).join(' '), Math.round(d.shares), cents(d.avg_cost), pct(d.win_rate), signedUsd(d.net), signedUsd(s.by_day[i]?.net ?? 0)]),
    },
    price: {
      cols: f.by_price.map((b) => col(String(b.lo), [`${Math.round(b.lo * 100)} to`, `${Math.round(b.hi * 100)}¢`], b, Math.abs(b.net) > 60)),
      ticks: [-50, 0, 50, 100, 150],
      sub: 'By the price of each fill. Fills under 50¢ are a favourite that had fallen since its first quote.',
      rows: f.by_price.map((b, i) => [`${Math.round(b.lo * 100)} to ${Math.round(b.hi * 100)}¢`, Math.round(b.shares), cents(b.avg_cost), pct(b.win_rate), signedUsd(b.net), signedUsd(s.by_price[i]?.net ?? 0)]),
    },
  };
  const v = views[view];
  return (
    <Figure
      testId="figure-sources"
      title={`${usd(NORMAL.identity.net)} of profit, split three ways`}
      sub={v.sub}
      source="Fills under normal execution. Each split adds back to the account total. The table also lists stressed execution."
      table={{ head: ['Group', 'Shares', 'All-in cost', 'Shares won', 'Net, normal', 'Net, stressed'], rows: v.rows }}
      controls={
        <div className="seg" role="group" aria-label="Split the profit by" style={{ justifySelf: 'start' }}>
          {([['anchor', 'By discount'], ['day', 'By day'], ['price', 'By price paid']] as const).map(([k, label]) => (
            <button key={k} aria-pressed={view === k} onClick={() => onView(k)} data-testid={`button-source-${k}`}>{label}</button>
          ))}
        </div>
      }
    >
      {(size, setTip) => <Columns key={view} cols={v.cols} size={size} setTip={setTip} ticks={v.ticks} />}
    </Figure>
  );
}
