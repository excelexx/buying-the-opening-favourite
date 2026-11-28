import { useState } from 'react';
import type { Slide } from '@/deck';
import { X, NORMAL, STRESSED, FRICTION, fee, longDate, type Scenario } from '@/data/exhibits';
import { Copy, Plate, Lead, Foot, Takeaway, Tiles } from '@/components/Layout';
import { Tex } from '@/components/Tex';
import { cents, pct, signedUsd, usd } from '@/figures/kit';
import { CalibrationFigure } from '@/figures/Calibration';
import { BreakEvenFigure, bucketFor } from '@/figures/BreakEven';
import { LedgerFigure } from '@/figures/Ledger';
import { CapitalFigure } from '@/figures/Capital';
import { SourcesFigure, type SourceView } from '@/figures/Sources';
import { CorrelationFigure, zAt } from '@/figures/Correlation';
import { DatesFigure, type DateView } from '@/figures/Dates';
import { RobustnessFigure } from '@/figures/Robustness';

const o = X.opening;
const int = (v: number) => Math.round(v).toLocaleString('en-US');
const f2 = (v: number) => v.toFixed(2).replace('-', '−');

/** Why the favourite: the market's own favourites are priced too low. */
function Thesis({ ch }: { ch: Slide }) {
  return (
    <>
      <Copy ch={ch}>
        <Lead>
          A contract that pays $1 if a candidate wins is a probability with a price tag. At 86¢ the market is saying 86%.
          If that were exactly right, no buying rule could win, and fees would make every rule lose.
        </Lead>
        <p className="body" style={{ marginTop: '.8rem' }}>
          So we looked for a place where prices are reliably off. As each buying window opened, three days before the vote, we noted the favourite’s price, then waited to see who won.
        </p>
        <Tiles items={[
          { k: 'Favourites were priced at', v: pct(o.mean_mid), d: `average of ${o.settled} contracts` },
          { k: 'They won', v: pct(o.win_rate), d: `${o.wins} of ${o.settled}` },
          { k: 'Gap', v: `+${(o.gap_mid.mean * 100).toFixed(1)} points`, d: 'won more often than priced' },
        ]} />
        <Takeaway>
          We never forecast an election. The market picks the side, and we bet it has not gone far enough.
          The gap sits in the strong favourites: above 70¢ every group won more often than it cost.
        </Takeaway>
        <Foot>
          The same tilt, cheap contracts overpriced and expensive ones underpriced, is documented across over 300,000 Kalshi contracts
          by <a href="https://www.ifo.de/en/cesifo/publications/2025/working-paper/makers-and-takers-economics-kalshi-prediction-market" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', textUnderlineOffset: '.15em' }}>Bürgi, Deng and Whelan (2025)</a>.
          They find it weaker in politics, one reason we size the claim carefully later on.
        </Foot>
      </Copy>
      <Plate ch={ch}><CalibrationFigure /></Plate>
    </>
  );
}

/** One share: expected value, the fee hump, the break-even win rate. */
function Share({ ch }: { ch: Slide }) {
  const [price, setPrice] = useState(0.88);
  const [scenario, setScenario] = useState<Scenario>('normal');
  const c = FRICTION[scenario];
  const b = bucketFor(price);
  const need = price + fee(price) + c;
  const strong = o.buckets.filter((k) => k.lo >= 0.7);
  const gaps = strong.map((k) => k.win_rate - k.mean_ask);
  return (
    <>
      <Copy ch={ch}>
        <Lead>Buy one share at price <Tex>p</Tex>. It pays $1 with probability <Tex>q</Tex> and nothing otherwise. Everything else is built from this.</Lead>
        <Tex block>{String.raw`\mathbb{E}[\text{profit}] \;=\; q \;-\; p \;-\; \underbrace{0.07\,p\,(1-p)}_{\text{exchange fee}} \;-\; \underbrace{c}_{\text{extra cost}}`}</Tex>
        <p className="body" style={{ marginTop: '.8rem' }}>Set that to zero and you get the win rate a share must beat:</p>
        <Tex block>{String.raw`q^{*} \;=\; p + 0.07\,p\,(1-p) + c`}</Tex>
        <div className="eq eq-sm" data-testid="live-breakeven" style={{ marginTop: '.5rem', color: 'var(--ink-soft)' }}>
          <Tex>{String.raw`q^{*} = ${price.toFixed(2)} + 0.07(${price.toFixed(2)})(${(1 - price).toFixed(2)}) + ${c.toFixed(3)} = ${(need * 100).toFixed(2)}\%`}</Tex>
        </div>
        <dl className="where">
          <dt><Tex>p</Tex></dt><dd>price paid, in dollars</dd>
          <dt><Tex>q</Tex></dt><dd>true chance the chosen side wins</dd>
          <dt><Tex>c</Tex></dt><dd>modeled extra cost per share: 0.1¢ normal, 1.1¢ stressed</dd>
        </dl>
        <Takeaway>
          The fee is a hump: {cents(fee(0.5), 2)} on a 50¢ coin flip, {cents(fee(0.95), 2)} at 95¢. Favourites are the cheapest contracts to trade.
          Above 70¢ the hurdle is at most {cents(fee(0.7) + c, 1)}, and the sample cleared the ask by {cents(Math.min(...gaps), 1)} to {cents(Math.max(...gaps), 1)}.
        </Takeaway>
        <Foot>
          At {Math.round(price * 100)}¢ a share must win {pct(need, 2)} of the time. Contracts that opened in this range won {pct(b.win_rate)}, {b.wins} of {b.n}.
        </Foot>
      </Copy>
      <Plate ch={ch}><BreakEvenFigure price={price} onPrice={setPrice} scenario={scenario} onScenario={setScenario} /></Plate>
    </>
  );
}

/** The account identity and the return split into margin and turnover. */
function Identity({ ch }: { ch: Slide }) {
  const [scenario, setScenario] = useState<Scenario>('normal');
  const id = X.scenarios[scenario].identity;
  return (
    <>
      <Copy ch={ch}>
        <Lead>Add up every share the account ever bought. Each one cost its price plus fees, and paid $1 or nothing.</Lead>
        <Tex block>{String.raw`\text{Profit} \;=\; \sum_i h_i\,(W_i - c_i) \;=\; H\,(\bar{w} - \bar{c})`}</Tex>
        <div className="eq eq-sm" data-testid="live-identity" style={{ marginTop: '.45rem' }}>
          <Tex>{String.raw`${id.shares.toLocaleString('en-US').replace(/,/g, '{,}')} \times (${id.win_rate.toFixed(6)} - ${id.avg_cost.toFixed(6)}) = \$${id.net.toFixed(2)}`}</Tex>
        </div>
        <dl className="where">
          <dt><Tex>H</Tex></dt><dd>shares bought across all markets</dd>
          <dt><Tex>{String.raw`\bar{w}`}</Tex></dt><dd>share of those that won, which is the average payout per share</dd>
          <dt><Tex>{String.raw`\bar{c}`}</Tex></dt><dd>average all-in cost per share: price, fees, extra cost</dd>
        </dl>
        <p className="body" style={{ marginTop: '.9rem' }}>The same profit, as a return on the starting account:</p>
        <Tex block small>{String.raw`\frac{\text{Profit}}{\$1{,}000} \;=\; \underbrace{\frac{\text{Profit}}{\text{Spent}}}_{${(id.margin * 100).toFixed(3)}\%} \times \underbrace{\frac{\text{Spent}}{\$1{,}000}}_{${id.turnover.toFixed(3)}} \;=\; ${id.return_pct.toFixed(2)}\%`}</Tex>
        <Takeaway>
          The edge is thin: {cents(id.edge_per_share, 1)} on a {cents(id.avg_cost, 0)} share. The return is not, because settled cash goes
          straight back to work. The account was spent {id.turnover.toFixed(1)} times over.
        </Takeaway>
      </Copy>
      <Plate ch={ch}><LedgerFigure scenario={scenario} onScenario={setScenario} /></Plate>
    </>
  );
}

/** One shared account: reservation, pro-rata funding, the fill model, and sizing. */
function Capital({ ch }: { ch: Slide }) {
  const cap = NORMAL.capital;
  return (
    <>
      <Copy ch={ch}>
        <Lead>Every market draws on the same cash. On a big night hundreds of contracts ask for it at once, so the model has to say who gets what.</Lead>
        <ol className="steps">
          <li><span>
            <b>Reserve.</b> Each request sets aside its worst-case bill per share, the limit price plus fee and extra cost:
            <Tex block small>{String.raw`r \;=\; p + c + 0.07\,p\,(1-p) + \varepsilon`}</Tex>
          </span></li>
          <li><span>
            <b>Share.</b> If the requests at one instant exceed free cash, each is scaled by the same fraction and rounded down:
            <Tex block small>{String.raw`\varphi \;=\; \min\!\Big(1,\; \frac{\text{free cash}}{\sum_j q_j\,r_j}\Big), \qquad \tilde{q}_j = \lfloor \varphi\,q_j \rfloor`}</Tex>
          </span></li>
          <li><span>
            <b>Fill.</b> A later trade of size <Tex>V</Tex> fills at most a slice <Tex>{String.raw`\kappa`}</Tex> of itself, 2.5% normal or 1% stressed, after a delay:
            <Tex block small>{String.raw`\text{fill} \;=\; \min\big(\text{remaining},\; \lfloor \kappa\,V \rfloor\big)`}</Tex>
          </span></li>
        </ol>
        <Tiles items={[
          { k: 'Orders placed', v: int(cap.orders) },
          { k: 'Fills', v: int(cap.fills) },
          { k: 'Requests cut to zero for lack of cash', v: int(cap.rejected_requests) },
        ]} />
        <Foot>
          Only {pct(NORMAL.identity.shares / cap.funded_shares, 1)} of the shares in funded orders ever filled, so liquidity was the usual limit.
          Cash ran short only around the two general elections.
        </Foot>
      </Copy>
      <Plate ch={ch}><CapitalFigure /></Plate>
    </>
  );
}

/** Decomposition of the profit by discount, by day and by price paid. */
function Sources({ ch }: { ch: Slide }) {
  const [view, setView] = useState<SourceView>('anchor');
  const a = NORMAL.fills.by_anchor;
  const ph = NORMAL.fills.by_phase;
  const s = STRESSED.fills.by_anchor;
  return (
    <>
      <Copy ch={ch}>
        <Lead>The rule never asks for a discount. It fixes the favoured side at the first quote, then keeps buying that side at whatever the ask becomes.</Lead>
        <p className="body" style={{ marginTop: '.8rem' }}>
          Sorting the fills by price shows what that did. Shares bought below the opening midpoint made {usd(a.below.net)}.
          Shares bought at or above it lost {usd(Math.abs(a.at_or_above.net))}.
        </p>
        <Tiles items={[
          { k: 'Below the opening midpoint', v: signedUsd(a.below.net), d: `${cents(a.below.avg_cost)} paid, ${pct(a.below.win_rate)} won` },
          { k: 'At or above it', v: signedUsd(a.at_or_above.net), d: `${cents(a.at_or_above.avg_cost)} paid, ${pct(a.at_or_above.win_rate)} won` },
          { k: 'Dipped, then still won', v: `${a.below.markets_won} of ${a.below.markets}`, d: 'markets with a fill below the open' },
        ]} />
        <Takeaway>
          The first quote works as an anchor. The money came from buying the favourite when it was marked down. The appendix tests the natural next step: waiting for that discount.
        </Takeaway>
        <Foot>
          By timing, {usd(ph.before.net)} came from shares bought through voting day and {usd(ph.after.net)} from the day after.
          Stressed execution splits the same way: {signedUsd(s.below.net)} below the opening midpoint and {signedUsd(s.at_or_above.net)} at or above it.
        </Foot>
      </Copy>
      <Plate ch={ch}><SourcesFigure view={view} onView={setView} /></Plate>
    </>
  );
}

/** Correlation between same-night contracts and what it does to the evidence. */
function Correlation({ ch }: { ch: Slide }) {
  const [rho, setRho] = useState(Math.round(o.same_night_corr * 200) / 200);
  const big = o.big_nights;
  return (
    <>
      <Copy ch={ch}>
        <Lead>
          {NORMAL.positions.positions} positions sound like {NORMAL.positions.positions} bets. If results on the same night move together it is far fewer, and one lucky night can pass for skill.
        </Lead>
        <Tex block small>{String.raw`\operatorname{Var}\Big(\sum_i X_i\Big) \;=\; \sum_i \sigma_i^2 \;+\; \rho \sum_{\text{night}} \sum_{i \neq j} \sigma_i\,\sigma_j`}</Tex>
        <Tex block small>{String.raw`\sigma_i = h_i\sqrt{p_i(1-p_i)}, \qquad N_{\text{eff}} \;=\; \frac{N}{1 + (N-1)\,\rho}`}</Tex>
        <dl className="where">
          <dt><Tex>{String.raw`\sigma_i`}</Tex></dt><dd>dollar spread of position <Tex>i</Tex>: <Tex>h_i</Tex> shares at price <Tex>p_i</Tex></dd>
          <dt><Tex>{String.raw`\rho`}</Tex></dt><dd>correlation between two results decided on the same night</dd>
        </dl>
        <p className="body" style={{ marginTop: '.65rem' }}>
          We estimate <Tex>{String.raw`\rho`}</Tex> at {f2(o.same_night_corr)} from the {o.settled} opening prices. With the dates shuffled, so that no correlation exists,
          19 estimates in 20 still land between {f2(o.same_night_null_lo)} and {f2(o.same_night_null_hi)}. The data cannot tell {f2(o.same_night_corr)} from zero, or rule out 0.1.
        </p>
        {big.length === 2 && (
          <p className="body" style={{ marginTop: '.45rem' }}>
            One steadying sign: on the two general-election nights favourites beat their price
            by {(big[0]!.gap_mid * 100).toFixed(1)} points in {big[0]!.date.slice(0, 4)} and {(big[1]!.gap_mid * 100).toFixed(1)} in {big[1]!.date.slice(0, 4)}.
          </p>
        )}
        <Takeaway>
          At zero correlation the profit is {zAt(0).toFixed(2)} standard deviations above a fair market. At our estimate it is {zAt(o.same_night_corr).toFixed(2)},
          and at 0.1 it is {zAt(0.1).toFixed(2)}. Promising, not proven.
        </Takeaway>
      </Copy>
      <Plate ch={ch}><CorrelationFigure rho={rho} onRho={setRho} /></Plate>
    </>
  );
}

/** The evidence for and against, stated plainly. */
function Confidence({ ch }: { ch: Slide }) {
  const [view, setView] = useState<DateView>('dates');
  const r = NORMAL.risk;
  const nets = X.start_days.map((d) => d.net);
  const li = { display: 'grid', gridTemplateColumns: '1.1rem 1fr', gap: '.4rem' } as const;
  const mark = (good: boolean) => <span aria-hidden style={{ fontWeight: 700, color: good ? 'var(--yes-hex)' : 'var(--ink-hex)' }}>{good ? '+' : '−'}</span>;
  return (
    <>
      <Copy ch={ch}>
        <Lead>Encouraged, not certain. The evidence, on both sides:</Lead>
        <ul style={{ marginTop: '.9rem', display: 'grid', gap: '.42rem', fontSize: '1rem', lineHeight: 1.4 }}>
          <li style={li}>{mark(true)}<span>All three years made money, under both execution settings.</span></li>
          <li style={li}>{mark(true)}<span>All eight full-period replays are positive, from {usd(Math.min(...nets), 0)} to {usd(Math.max(...nets), 0)}.</span></li>
          <li style={li}>{mark(true)}<span>{r.winning_dates} of {r.active_dates} voting dates with purchases made money.</span></li>
          <li style={li}>{mark(true)}<span>Favourites beat their opening price by {(o.gap_mid.mean * 100).toFixed(1)} points: about {(o.gap_mid.mean / o.gap_mid.se_iid).toFixed(0)} standard errors if contracts are independent, and still positive in {pct(o.gap_mid.boot_share_positive, 0)} of redraws of the voting dates.</span></li>
          <li style={li}>{mark(false)}<span>One night, {longDate(r.top_date)}, is {pct(r.top_date_share, 0)} of the profit. Without it the account made {usd(r.net_without_top_date)}.</span></li>
          <li style={li}>{mark(false)}<span>Redraw the voting dates and {pct(1 - r.boot_share_positive, 0)} of accounts lose money.</span></li>
          <li style={li}>{mark(false)}<span>After the spread, fees and costs, one share of every favourite at its opening ask kept {cents(o.net_per_share.mean, 1)}, with a standard error of {cents(o.net_per_share.se_iid, 1)}.</span></li>
        </ul>
        <Takeaway>This is evidence of an edge, not proof of one. Voting dates after the cutoff are the real test.</Takeaway>
      </Copy>
      <Plate ch={ch}><DatesFigure view={view} onView={setView} /></Plate>
    </>
  );
}

/** Limits of the test, and what to test next. */
function Limits({ ch }: { ch: Slide }) {
  const pres = X.lockup.by_type.find((t) => t.type.startsWith('President'));
  return (
    <>
      <Copy ch={ch}>
        <Lead>The replay establishes one narrow thing: these fixed rules, on this fixed data, give these numbers. Four things sit outside it.</Lead>
        <ol className="steps">
          <li><span><b>Hindsight.</b> The roster and the parameters were settled after the outcomes were known.</span></li>
          <li><span><b>Fills.</b> A fill here is a slice of a recorded trade. It does not show our place in the queue, or what our order would have done to the price.</span></li>
          <li><span><b>Concentration.</b> Two general-election nights hold {o.largest_nights[0]! + o.largest_nights[1]!} of the {o.settled} priced contracts and most of the profit.</span></li>
          <li><span>
            <b>Lock-up.</b> Cash is stuck until settlement. Half of contracts paid out by the day after the vote,
            but the 2024 presidential contracts took {pres ? Math.round(pres.median_days) : 63} days.
          </span></li>
        </ol>
        <Takeaway>
          Next: run it forward on dates after the cutoff, rest bids instead of paying the ask, require the discount, and weight toward favourites above 70¢.
        </Takeaway>
      </Copy>
      <Plate ch={ch}><RobustnessFigure /></Plate>
    </>
  );
}

function body(ch: Slide) {
  switch (ch.id) {
    case 'thesis': return <Thesis ch={ch} />;
    case 'share': return <Share ch={ch} />;
    case 'identity': return <Identity ch={ch} />;
    case 'capital': return <Capital ch={ch} />;
    case 'sources': return <Sources ch={ch} />;
    case 'correlation': return <Correlation ch={ch} />;
    case 'confidence': return <Confidence ch={ch} />;
    case 'limits': return <Limits ch={ch} />;
    default: return null;
  }
}

/** On a wide screen the wrapper is invisible. On a phone it becomes one scrolling page: text, then figure. */
export function MathChapter({ ch }: { ch: Slide }) {
  return <div className="figure-chapter">{body(ch)}</div>;
}
