export type SectionId = 'idea' | 'rule' | 'results' | 'math' | 'risk' | 'appendix';

export type Slide = {
  id: string;
  title: string;
  section: SectionId;
  /** What the exhibit is: a 3D station, the full-bleed order replay, or a figure plate. */
  kind: 'scene' | 'replay' | 'figure';
  align?: 'left' | 'right';
  dwell: number;
  /** One of the nine chapters of the original deck. Their titles, order and text are unchanged. */
  core?: boolean;
  wide?: boolean;
  /** One line for the chapter overview. */
  summary: string;
};

export const SPACING = 16;

export const sections: { id: SectionId; label: string }[] = [
  { id: 'idea', label: 'The idea' },
  { id: 'rule', label: 'The rule' },
  { id: 'results', label: 'Results' },
  { id: 'math', label: 'The math' },
  { id: 'risk', label: 'How sure' },
  { id: 'appendix', label: 'Appendix' },
];

export const allChapters: Slide[] = [
  { id: 'open', title: 'buying the opening favourite', section: 'idea', kind: 'scene', dwell: 9, core: true,
    summary: 'One rule, one $1,000 account, 52 voting dates.' },
  { id: 'types', title: 'Election types in the strategy', section: 'idea', kind: 'scene', dwell: 9, align: 'right', core: true,
    summary: 'Which contests are in the fixed roster.' },
  { id: 'thesis', title: 'Why buy the favourite?', section: 'idea', kind: 'figure', dwell: 16,
    summary: 'Favourites won more often than their opening price said.' },

  { id: 'buying', title: 'How buying works', section: 'rule', kind: 'scene', dwell: 16, core: true,
    summary: 'Clips of 10 shares, a cap of 100, hold to settlement.' },
  { id: 'replay', title: 'Buying windows, voting and settlement', section: 'rule', kind: 'replay', dwell: 0, core: true,
    summary: 'A playable, fictional three-market order replay.' },
  { id: 'trigger', title: 'What triggers another purchase?', section: 'rule', kind: 'scene', dwell: 13, align: 'right', core: true, wide: true,
    summary: 'Quotes place orders. Trades decide what fills.' },

  { id: 'results', title: 'Profit by year and across the full period', section: 'results', kind: 'scene', dwell: 13, align: 'right', core: true, wide: true,
    summary: 'Positive in each year and across 2024 to 2026.' },
  { id: 'start', title: 'Profit at four buying start dates', section: 'results', kind: 'scene', dwell: 11, core: true,
    summary: 'The same replay started three, two, one and zero days before voting.' },

  { id: 'share', title: 'One share is one weighted coin', section: 'math', kind: 'figure', dwell: 18,
    summary: 'Expected value, the fee curve and the break-even win rate.' },
  { id: 'identity', title: 'The whole account in one line', section: 'math', kind: 'figure', dwell: 16,
    summary: 'Profit is shares times the gap between win rate and cost.' },
  { id: 'capital', title: 'One account, many markets', section: 'math', kind: 'figure', dwell: 16,
    summary: 'Reserving cash, sharing it pro rata, and recycling it.' },
  { id: 'sources', title: 'Where the profit came from', section: 'math', kind: 'figure', dwell: 18,
    summary: 'Split by discount to the opening price, by day and by price paid.' },

  { id: 'correlation', title: 'Is one election night one bet?', section: 'risk', kind: 'figure', dwell: 18,
    summary: 'What correlation between contracts does to the evidence.' },
  { id: 'confidence', title: 'How sure are we?', section: 'risk', kind: 'figure', dwell: 16,
    summary: 'Profit by voting date, and what resampling the dates says.' },
  { id: 'limits', title: 'What could break it', section: 'risk', kind: 'figure', dwell: 16,
    summary: 'Limits of the test and what we would check next.' },

  { id: 'stressed', title: 'Appendix: stressed profits', section: 'appendix', kind: 'scene', dwell: 13, align: 'right', core: true, wide: true,
    summary: 'Slower, smaller, costlier fills.' },
  { id: 'appendix', title: 'Appendix: two ways to wait for a discount', section: 'appendix', kind: 'scene', dwell: 13, align: 'right', core: true, wide: true,
    summary: 'Two entry rules that ask for a lower price first.' },
];

/** The nine chapters of the original deck, in their original order. */
export const coreChapters = allChapters.filter((c) => c.core);
/** Chapters that own a station on the 3D rail, in travel order. */
export const stations = allChapters.filter((c) => c.kind !== 'figure');
/** Kept for modules that only need the full list. */
export const chapters = allChapters;

export const types = [
  'Presidential elections by state',
  'U.S. Senate and House elections',
  'Governor and attorney general elections',
  'Mayoral and other state or local elections',
  'Party primaries and runoffs',
  'Ballot measures',
];

export const buyingSteps = [
  'Pick its favored YES or NO side, then request up to 10 shares at the current asking price, provided there is available cash.',
  'After that order fills or expires after 30 seconds, try another at the next usable quote. Markets with quicker fills can accumulate shares sooner.',
  'Keep going until you own 100 shares per contract, lack available cash, or its buying window ends. Simultaneous requests share scarce cash proportionally.',
  'Hold every purchased share until the contract settles and pays. This can take longer than three days. A winning share pays $1 and a losing share pays $0.',
];

export const normalRows = [
  { p: '2024 only', v: '+$165.11', r: '16.51%' },
  { p: '2025 only', v: '+$36.20', r: '3.62%' },
  { p: '2026 only', v: '+$72.52', r: '7.25%' },
  { p: '2024–2026 continuous', v: '+$301.55', r: '30.16%' },
];
export const stressedRows = [
  { p: '2024 only', v: '+$148.55', r: '14.86%' },
  { p: '2025 only', v: '+$28.51', r: '2.85%' },
  { p: '2026 only', v: '+$40.17', r: '4.02%' },
  { p: '2024–2026 continuous', v: '+$229.94', r: '22.99%' },
];

/** Values from the embedded chart in the source PPTX (slide 7). */
export const startChart = [
  { label: '3 days before', v: 301.55 },
  { label: '2 days before', v: 202.65 },
  { label: '1 day before', v: 314.33 },
  { label: 'Voting day', v: 223.69 },
];

export const fillExample = [
  { t: '10:00:00', what: 'Usable quote: place an order for 10 shares', held: 0 },
  { t: '10:00:02', what: 'Eligible 160-share trade: 4 shares fill', held: 4 },
  { t: '10:00:08', what: 'Eligible 240-share trade: the last 6 fill', held: 10 },
  { t: '10:00:09', what: 'Next usable quote: place another 10-share order', held: 10 },
  { t: '10:00:12', what: 'Eligible 400-share trade: 10 shares fill', held: 20 },
];

/** The two waiting variants come from the source deck. Their code is outside this repository. */
export const discount = [
  { label: 'Buy immediately', normal: '$301.55', stressed: '$229.94' },
  { label: 'Always wait for a discount', normal: '$411.55', stressed: '$265.86' },
  { label: 'Use the calendar exception', normal: '$438.08', stressed: '$339.85' },
];
