export type Chapter = {
  id: string;
  kicker: string;
  title: string;
  body: string[];
  facts?: { k: string; v: string }[];
  align?: 'left' | 'right';
  dwell: number;
};

export const SPACING = 16;

export const chapters: Chapter[] = [
  {
    id: 'open', kicker: 'An animated strategy exhibition', title: 'Buying the Opening Favourite',
    body: ['Three days before a vote, a prediction market already has an opinion. This strategy simply takes it at its word, buys the side the market favours at the first usable minute, and waits for the result.'],
    facts: [{ k: 'Window', v: '2024 to 2026' }, { k: 'Cut-off', v: '20 Nov 2026, 00:00 UTC' }], dwell: 9,
  },
  {
    id: 'universe', kicker: 'Chapter 01 / The universe', title: '1,780 chances on 52 voting dates',
    body: ['Every scheduled election contract in a fixed, retrospective universe. 530 of them were actually listed. The rest never opened and are counted, not imagined.'],
    facts: [{ k: 'Scheduled', v: '1,780' }, { k: 'Voting dates', v: '52' }, { k: 'Listed', v: '530' }], dwell: 9, align: 'right',
  },
  {
    id: 'types', kicker: 'Chapter 01b / What counts', title: 'Every kind of ballot',
    body: ['Presidential elections by state. U.S. Senate and House. Governor and attorney general. Mayoral and other state or local races. Party primaries and runoffs. Ballot measures.', 'In each, buy the YES or NO side with the higher market probability of winning.'],
    dwell: 9, align: 'right',
  },
  {
    id: 'select', kicker: 'Chapter 02 / The rule', title: 'Above the line, YES. Below it, NO.',
    body: ['Take the first usable minute-end midpoint. Above 50% buys YES; below 50% buys NO. An exact tie skips that market forever. No second opinions.'],
    facts: [{ k: '> 50%', v: 'YES' }, { k: '< 50%', v: 'NO' }, { k: '= 50%', v: 'skip' }], dwell: 10,
  },
  {
    id: 'clock', kicker: 'Chapter 03 / When', title: 'The clock starts at D-3, 00:00 UTC',
    body: ['Selection is fixed at the strategy opening, three days before the vote, not when the exchange lists a contract. Buying stops at the earlier of native close or 00:00 UTC on D+2.'],
    facts: [{ k: 'Opens', v: 'D-3 00:00 UTC' }, { k: 'Stops buying', v: 'min(close, D+2)' }], dwell: 10, align: 'right',
  },
  {
    id: 'size', kicker: 'Chapter 04 / Sizing', title: 'Ten shares at a time, a hundred at most',
    body: ['Buy at the current ask on the chosen side, no discount required. Each order is capped at 10 shares; each market at 100 cumulative shares. One live order per market.'],
    facts: [{ k: 'Order cap', v: '10 sh' }, { k: 'Market cap', v: '100 sh' }, { k: 'Live per market', v: '1' }], dwell: 10,
  },
  {
    id: 'alice', kicker: 'Chapter 04b / A fictional week', title: 'Alice and Bob, from window to payout',
    body: ['YES on Alice, NO on Bob. Each market opens to buying on its own date and closes on voting day. Alice reaches 30 shares; Bob reaches 20. Alice wins: $30 paid. Bob wins too, so our NO pays $0. Settlement can take longer than three days, and settled cash can fund later elections.'],
    dwell: 13,
  },
  {
    id: 'cash', kicker: 'Chapter 05 / Cash', title: 'One thousand dollars, fully reserved',
    body: ['Every run starts with $1,000. Each order reserves its full price plus modelled costs. When requests collide, they are scaled down proportionally and rounded down to native lots. Money arriving in the same second cannot pay for them.'],
    facts: [{ k: 'Initial cash', v: '$1,000' }, { k: 'Reserve', v: 'order + costs' }], dwell: 11, align: 'right',
  },
  {
    id: 'fill', kicker: 'Chapter 06 / Fills', title: 'Thirty seconds to be filled',
    body: ['Partial fills only come from eligible later trades, against quotes no older than 30 seconds. Whatever remains expires at 30s. The next usable quote can try again.'],
    facts: [{ k: 'Quote age', v: '<= 30 s' }, { k: 'Expiry', v: '30 s' }], dwell: 10,
  },
  {
    id: 'trigger', kicker: 'Chapter 06b / Second by second', title: 'What triggers another purchase?',
    body: ['We try at each usable quote when there is no live order, enough cash and room below the cap. Trades decide what fills: up to 2.5% of an eligible trade, after a 2-second delay.'],
    dwell: 13, align: 'right',
  },
  {
    id: 'stress', kicker: 'Chapter 07 / Friction', title: 'Normal friction, and a harsher world',
    body: ['Normal: 2 s delay, 2.5% trade participation, +0.1 cent per share. Stressed: 5 s delay, 1% participation, +1.1 cent per share. Dated exchange fees apply to both.'],
    facts: [{ k: 'Normal', v: '2s / 2.5% / +0.1c' }, { k: 'Stressed', v: '5s / 1% / +1.1c' }], dwell: 11, align: 'right',
  },
  {
    id: 'hold', kicker: 'Chapter 08 / Patience', title: 'Hold until the vote is counted',
    body: ['No early sales. Each winning share settles at $1, each losing share at $0. Of the listed markets, 285 saw purchases under normal friction and 279 under stress.'],
    facts: [{ k: 'Purchases normal', v: '285' }, { k: 'Purchases stressed', v: '279' }], dwell: 10,
  },
  {
    id: 'results', kicker: 'Chapter 09 / Saved results', title: 'What a thousand dollars became',
    body: ['Each annual run starts fresh with $1,000. The continuous run is one $1,000 carried across 2024 to 2026: not additive, cumulative, not annualised.'],
    dwell: 14, align: 'right',
  },
  {
    id: 'start', kicker: 'Chapter 09b / Start date', title: 'Starting earlier helped',
    body: ['Normal execution across 2024 to 2026, moving both the first observation and first possible purchase. Three days before voting: $301.55. Voting day itself: $223.69.', 'Stressed, with starts 3, 2, 1 and 0 days before: $229.94, $111.09, $211.00 and $135.38.'],
    dwell: 11,
  },
  {
    id: 'replay', kicker: 'Chapter 10 / Step inside', title: 'Watch orders come and go',
    body: ['A compressed, synthetic replay. About 100 animation seconds stand in for a holding period from D-3 to settlement. Illustrative inputs, not historical fills.'],
    dwell: 30,
  },
  {
    id: 'limits', kicker: 'Chapter 11 / Honest limits', title: 'What this does not prove',
    body: [
      'A retrospective, fixed universe chosen after the fact.',
      'Hypothetical execution: queue position is never guaranteed.',
      'Not live trading. Fees, liquidity and listing rules can change.',
      'Three short years, few independent voting dates, correlated outcomes.',
    ],
    dwell: 12,
  },
  {
    id: 'appendix', kicker: 'Appendix / Reported only', title: 'Two ways to wait for a discount',
    body: ['A reported comparison, not the strategy simulated here. Same roster, side, account and settlement; only the entry price rule changes. Waiting buys only when ask plus estimated costs falls below the opening midpoint; the calendar variant buys immediately on federal general-election dates.'],
    dwell: 12, align: 'right',
  },
  {
    id: 'sources', kicker: 'Chapter 12 / Sources', title: 'Read the full method',
    body: ['The original deck is attached here. The repository is private; the link works for those with access.'], dwell: 10, align: 'right',
  },
];

export const results = [
  { label: '2024', normal: 165.11, np: 16.51, stressed: 148.55, sp: 14.86 },
  { label: '2025', normal: 36.2, np: 3.62, stressed: 28.51, sp: 2.85 },
  { label: '2026', normal: 72.52, np: 7.25, stressed: 40.17, sp: 4.02 },
  { label: '2024-26', normal: 301.55, np: 30.16, stressed: 229.94, sp: 22.99 },
];

export const fillExample = [
  { t: '10:00:00', what: 'Usable quote: place an order for 10 shares', held: 0 },
  { t: '10:00:02', what: 'Eligible 160-share trade: 4 shares fill', held: 4 },
  { t: '10:00:08', what: 'Eligible 240-share trade: the last 6 fill', held: 10 },
  { t: '10:00:09', what: 'Next usable quote: place another 10-share order', held: 10 },
  { t: '10:00:12', what: 'Eligible 400-share trade: 10 shares fill', held: 20 },
];

export const aliceBob = [
  { d: 'Nov 1', a: 'Start buying', b: '' },
  { d: 'Nov 3', a: '10 held', b: '' },
  { d: 'Nov 4', a: '30 held', b: 'Start buying' },
  { d: 'Nov 6', a: 'VOTE / CLOSE  30 held', b: '10 held' },
  { d: 'Nov 7', a: 'Settles  $30 paid', b: 'VOTE / CLOSE  20 held' },
  { d: 'Nov 8', a: '', b: 'Settles  $0 paid' },
];

export const discount = [
  { label: 'Buy immediately (this strategy)', normal: 301.55, stressed: 229.94 },
  { label: 'Always wait for a discount', normal: 411.55, stressed: 265.86 },
  { label: 'Use the calendar exception', normal: 438.08, stressed: 339.85 },
];
