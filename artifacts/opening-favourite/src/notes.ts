import { X, NORMAL, STRESSED, longDate } from '@/data/exhibits';

const o = X.opening;
const n = NORMAL;
const usd = (v: number, d = 2) => `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const cents = (v: number, d = 1) => `${(v * 100).toFixed(d)}¢`;
/** Kelly stake for one share of every opening favourite, bought at the ask with fees and normal extra cost. */
const kelly = o.net_per_share.mean / (1 - (o.win_rate - o.net_per_share.mean));
const starts = X.start_days.filter((d) => d.scenario === 'normal').map((d) => d.net);

/** Presenter notes: what to say, the number to land, and the question to expect. */
export const notes: Record<string, string[]> = {
  open: [
    'One rule, one $1,000 account, 52 voting dates from 2024 to the 20 November 2026 cutoff.',
    `${usd(n.identity.net)} is paper profit after modeled exchange fees and execution costs. It is not live trading.`,
    `Under stressed execution the same rule makes ${usd(STRESSED.identity.net)}.`,
  ],
  types: [
    `The roster has ${X.universe.cells.length.toLocaleString('en-US')} scheduled opportunities. ${o.listed} had a listed contract and ${n.positions.positions} were bought.`,
    'The roster was fixed in advance. It is a research population, not a live market scanner.',
    'Each tile on the right is one opportunity. Raised tiles are the markets we bought, and height is shares held.',
  ],
  thesis: [
    'A price is a probability. If prices were fair there would be nothing to win.',
    `Opening favourites were priced at ${pct(o.mean_mid)} and won ${pct(o.win_rate)}, across ${o.settled} contracts.`,
    'The gap is in the strong favourites. Between 50 and 70 cents there is no edge.',
    'If asked about the literature: the same tilt is documented across Kalshi, but weaker in politics.',
  ],
  buying: [
    'Clips of 10 shares, a cap of 100 per contract, one shared cash account.',
    'No forecast and no exit. Shares are held to settlement, so there is no second spread and no second fee.',
    'The side is fixed at the first usable quote and never flips.',
  ],
  replay: [
    'This is a fictional three-market example that shows the mechanics. It is not a record of historical fills.',
    'A buzzing card is an order that found no matching sellers. It expires after 30 seconds and the next quote tries again.',
    'Drag the slider to scrub. Our YES on Alice pays, our NO on Bob pays nothing, our YES on Carol pays.',
  ],
  trigger: [
    'Quotes place orders. Trades decide what fills.',
    'Normal execution takes at most 2.5% of an eligible trade after a 2 second delay.',
    'The 160-share trade fills 4 shares because 2.5% of 160 is 4.',
  ],
  results: [
    'Every year is positive. The annual rows restart at $1,000, so they do not add to the continuous total.',
    `The continuous account bought ${n.positions.positions} markets and ${n.positions.won} of the ${n.positions.settled} settled ones won.`,
    '2026 stops at the 20 November cutoff. Unsettled holdings count as no payout.',
  ],
  start: [
    'Same rule, started 3, 2, 1 and 0 days before each vote. All four are positive.',
    `The order is not monotone. The ${usd(Math.max(...starts) - Math.min(...starts), 0)} between best and worst is a fair picture of how noisy the estimate is.`,
  ],
  share: [
    'Break-even win rate is price plus fee plus extra cost.',
    'The fee is 7% of p times 1 minus p. It peaks at 1.75 cents on a coin flip and nearly vanishes on a favourite.',
    'Drag the price. Above 70 cents the favourites cleared the hurdle. Below it they did not.',
  ],
  identity: [
    `Profit is shares times the gap: ${n.identity.shares.toLocaleString('en-US')} shares, ${pct(n.identity.win_rate, 2)} won, ${cents(n.identity.avg_cost, 2)} paid.`,
    `Return of ${n.identity.return_pct.toFixed(2)}% is a ${pct(n.identity.margin, 2)} margin times ${n.identity.turnover.toFixed(2)} turns of the account.`,
    'The lever is turnover. Settled cash funds the next election.',
  ],
  capital: [
    'Three modeling choices: reserve the worst-case bill, share scarce cash pro rata, fill only a slice of real trades.',
    `Cash ran short only around the two general elections. ${n.capital.constrained_batches.toLocaleString('en-US')} batches were scaled down.`,
    `If asked about sizing: the 100-share cap is at most 10% of the account per contract. The Kelly stake (q − c)/(1 − c) at the sample's edge is about ${pct(kelly, 0)}, and an edge this uncertain argues for less.`,
  ],
  sources: [
    `Shares bought below the opening midpoint made ${usd(n.fills.by_anchor.below.net)}. Shares at or above it lost ${usd(Math.abs(n.fills.by_anchor.at_or_above.net))}.`,
    `${n.fills.by_anchor.below.markets_won} of ${n.fills.by_anchor.below.markets} markets that dipped below their opening price still won.`,
    'This is a decomposition of the buy-immediately rule. It points the same way as the discount variants in the appendix.',
  ],
  correlation: [
    'Correlation is what turns many bets into few. The formula shows how fast.',
    `Our estimate of same-night correlation is ${o.same_night_corr.toFixed(2)}, but shuffled dates produce anything from ${o.same_night_null_lo.toFixed(2)} to ${o.same_night_null_hi.toFixed(2)}. The data cannot pin it down.`,
    `At zero correlation the profit is ${n.risk.z_independent.toFixed(2)} standard deviations above a fair market. Drag the slider to 0.1 to show how quickly that falls.`,
    'If asked why correlation might be low: favourites sit on both sides, safe seats of each party, primaries in both, ballot measures. That is a reason to expect it, not a measurement.',
  ],
  confidence: [
    `${n.risk.winning_dates} winning dates and ${n.risk.losing_dates} losing ones. ${longDate(n.risk.top_date)} is ${pct(n.risk.top_date_share, 0)} of the profit.`,
    `Resampling the voting dates, ${pct(n.risk.boot_share_positive, 0)} of accounts end above zero.`,
    'Say it plainly: evidence of an edge, not proof of one.',
  ],
  limits: [
    'The roster and parameters were chosen in hindsight. The replay shows what the rules produce, not that we would have chosen them in advance.',
    'A fill is a hypothetical slice of a recorded trade. Queue position and market impact are not modeled.',
    'Next steps: forward test, resting bids, the discount rule, weighting to strong favourites.',
    'If asked about scale: the test takes at most 100 shares per contract and a 2.5% slice of each eligible trade. It says nothing about larger size, where our own orders would move prices.',
  ],
  stressed: [
    'Stressed means slower fills, a smaller slice of each trade and 1.1 cents of extra cost per share.',
    'Every row stays positive.',
  ],
  appendix: [
    'Both variants keep the roster, the side, the account and the settlement rule. Only the entry price rule changes.',
    'These two rows come from the original slides.',
  ],
};
