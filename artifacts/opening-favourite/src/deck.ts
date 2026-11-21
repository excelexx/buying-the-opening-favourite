export type Slide = { id: string; title: string; align?: 'left' | 'right'; dwell: number };

export const SPACING = 16;

export const chapters: Slide[] = [
  { id: 'open', title: 'buying the opening favourite', dwell: 9 },
  { id: 'types', title: 'Election types in the strategy', dwell: 9, align: 'right' },
  { id: 'buying', title: 'How buying works', dwell: 16 },
  { id: 'replay', title: 'Buying windows, voting and settlement', dwell: 0 },
  { id: 'trigger', title: 'What triggers another purchase?', dwell: 13, align: 'right' },
  { id: 'results', title: 'Profit by year and across the full period', dwell: 13, align: 'right' },
  { id: 'start', title: 'Profit at four buying start dates', dwell: 11 },
  { id: 'stressed', title: 'Appendix: stressed profits', dwell: 13, align: 'right' },
  { id: 'appendix', title: 'Appendix: two ways to wait for a discount', dwell: 13, align: 'right' },
];

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

export const discount = [
  { label: 'Buy immediately', normal: '$301.55', stressed: '$229.94' },
  { label: 'Always wait for a discount', normal: '$411.55', stressed: '$265.86' },
  { label: 'Use the calendar exception', normal: '$438.08', stressed: '$339.85' },
];
