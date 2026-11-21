/** A deterministic teaching replay, not historical market data or a live backtest.
 * Story time compresses election dates; order ages still use seconds.
 * The illustrative fee is a rounded 7% binary-contract taker-fee curve,
 * not a reproduction of the exchange's dated historical fee schedule.
 */
export type Scenario = 'normal' | 'stressed';
export type SimulationEvent = {
  time: number;
  type: 'submit' | 'fill' | 'expire' | 'settle' | 'quote' | 'skip';
  market: string;
  orderId: string;
  quantity: number;
  price: number;
  message: string;
};
export type SimulationOrder = {
  id: string; market: string; side: 'YES' | 'NO'; quantity: number;
  remaining: number; limit: number; submittedAt: number;
  status: 'live' | 'filled' | 'expired';
  endedAt?: number;
  endReason?: 'timeout' | 'window';
};
export type SimulationSnapshot = {
  time: number; cash: number; reserved: number; available: number; shares: number;
  orders: SimulationOrder[];
  holdings: { market: string; side: 'YES' | 'NO'; shares: number; cost: number; settled: boolean }[];
  events: SimulationEvent[];
};

export const timelineMilestones = [
  { time: 0, label: 'Nov 1', detail: 'First buying windows open' },
  { time: 15, label: 'Nov 2', detail: 'Keep attempting at usable quotes' },
  { time: 30, label: 'Nov 3', detail: 'Unfilled orders expire and retry' },
  { time: 45, label: 'Nov 4', detail: 'First voting date; buying can continue to D+2' },
  { time: 60, label: 'Nov 5', detail: 'Caps and cash constrain requests' },
  { time: 78, label: 'Nov 6', detail: 'First markets reach D+2 and close buying' },
  { time: 85, label: 'Nov 7', detail: 'Settlement begins' },
  { time: 90, label: 'Nov 8', detail: 'Settled cash funds a later election' },
  { time: 95, label: 'Nov 9', detail: 'Later buying window continues' },
  { time: 98, label: 'Nov 10', detail: 'Orders keep attempting before the next vote' },
  { time: 100, label: 'Nov 11', detail: 'Later election votes; holdings stay invested' },
  { time: 106, label: 'Nov 12', detail: 'Later market closes its buying window' },
  { time: 110, label: 'Nov 13', detail: 'Later holdings settle' },
];

export function storyDate(time: number): string {
  return [...timelineMilestones].reverse().find(point => time >= point.time)?.label ?? 'Nov 1';
}

export function simulate(scenario: Scenario): {
  duration: number; events: SimulationEvent[]; snapshots: SimulationSnapshot[];
} {
  const duration = 110;
  const delay = scenario === 'normal' ? 2 : 5;
  const participation = scenario === 'normal' ? 0.025 : 0.01;
  const extra = scenario === 'normal' ? 0.001 : 0.011;
  const money = (n: number) => Math.round(n * 1e8) / 1e8;
  const markets = [
    { name: 'Alice wins', side: 'YES' as const, ask: 0.64, wins: true },
    { name: 'Bob wins', side: 'NO' as const, ask: 0.73, wins: false },
    ...Array.from({ length: 12 }, (_, i) => ({
      name: ['Senate · East', 'Governor · West', 'House · North', 'Mayor · Central',
        'Ballot measure', 'Primary · South', 'Senate · West', 'House · East',
        'Governor · North', 'Runoff · South', 'Mayor · East', 'House · West'][i]!,
      side: (i % 3 === 0 ? 'NO' : 'YES') as 'YES' | 'NO',
      ask: 0.77 + (i % 4) * 0.035,
      wins: i % 5 !== 0,
    })),
    { name: 'Later election', side: 'YES' as const, ask: 0.68, wins: true },
  ];
  let cash = 1000;
  const orders: SimulationOrder[] = [];
  const holdings = markets.map(m => ({
    market: m.name, side: m.side, shares: 0, cost: 0, settled: false,
  }));
  const events: SimulationEvent[] = [];
  const snapshots: SimulationSnapshot[] = [];
  const reserveFor = (q: number, price: number) => q * (price + extra + 0.02);
  const reservedNow = () => orders.filter(o => o.status === 'live')
    .reduce((total, o) => total + reserveFor(o.remaining, o.limit), 0);
  const emit = (event: SimulationEvent) => events.push(event);

  for (let time = 0; time <= duration; time++) {
    // Requests are sized from beginning-of-timestamp cash. Trades and settlement
    // later in this timestamp cannot fund them.
    const requests = markets.flatMap((m, i) => {
      const opening = i === markets.length - 1 ? 90 : 0;
      const close = i === markets.length - 1 ? 106 : 78;
      const h = holdings[i]!;
      if (time < opening || time >= close || h.settled) return [];
      if (time === opening) {
        emit({ time, type: 'quote', market: m.name, orderId: '', quantity: 0,
          price: m.ask, message: `${m.name}: opening midpoint selects ${m.side}; side remains fixed.` });
      }
      if (orders.some(o => o.market === m.name && o.status === 'live') || h.shares >= 100) return [];
      return [{ m, q: Math.min(10, 100 - h.shares) }];
    });
    const available = Math.max(0, cash - reservedNow());
    const requestedCost = requests.reduce((sum, r) => sum + reserveFor(r.q, r.m.ask), 0);
    const fraction = requestedCost > 0 ? Math.min(1, available / requestedCost) : 0;
    for (const { m, q } of requests) {
      const quantity = Math.floor(q * fraction + 1e-9);
      if (quantity === 0) continue;
      const order: SimulationOrder = {
        id: `O${String(orders.length + 1).padStart(3, '0')}`,
        market: m.name, side: m.side, quantity, remaining: quantity,
        limit: m.ask, submittedAt: time, status: 'live',
      };
      orders.push(order);
      emit({ time, type: 'submit', market: m.name, orderId: order.id, quantity,
        price: m.ask, message: `${order.id}: request ${quantity} ${m.side} at ${(m.ask * 100).toFixed(1)}¢; cash reserved${fraction < 1 ? ' after proportional allocation' : ''}.` });
    }
    if (time === 0) emit({ time, type: 'skip', market: 'Tied opening market',
      orderId: '', quantity: 0, price: 0.5, message: 'Opening midpoint is exactly 50%: permanently skip this contract.' });

    for (const order of orders.filter(o => o.status === 'live')) {
      const marketIndex = markets.findIndex(m => m.name === order.market);
      const close = marketIndex === markets.length - 1 ? 106 : 78;
      const age = time - order.submittedAt;
      if (age >= 30 || time >= close) {
        order.status = 'expired';
        order.endedAt = time;
        order.endReason = time >= close ? 'window' : 'timeout';
        emit({ time, type: 'expire', market: order.market, orderId: order.id,
          quantity: order.remaining, price: order.limit,
          message: `${order.id}: tried ${order.quantity} shares at ${(order.limit * 100).toFixed(1)}¢. ${order.quantity === order.remaining ? 'No eligible trade filled the order, so no shares were bought.' : `${order.quantity - order.remaining} shares bought; ${order.remaining} unfilled shares cancelled.`} ${time >= close ? 'Buying window closed.' : '30-second limit reached.'} Unused reserved cash released.` });
        continue;
      }
      // Bob has no eligible tape activity until t=35, intentionally demonstrating
      // expiry. All synthetic quotes refresh each second, so quote age is zero.
      if (marketIndex === 1 && time < 35) continue;
      const eligibleTrade = time === 2 || time === 8 || time === 12 || (time > 12 && time % 3 === 0);
      if (!eligibleTrade || age < delay) continue;
      const volume = time === 2 ? 160 : time === 8 ? 240 : 400;
      const quantity = Math.min(order.remaining, Math.floor(volume * participation + 1e-9));
      if (!quantity) continue;
      const fee = Math.ceil(0.07 * quantity * order.limit * (1 - order.limit) * 100 - 1e-9) / 100;
      const cost = money(quantity * (order.limit + extra) + fee);
      cash = money(cash - cost);
      order.remaining -= quantity;
      if (order.remaining === 0) {
        order.status = 'filled';
        order.endedAt = time;
      }
      const h = holdings[marketIndex]!;
      h.shares += quantity;
      h.cost = money(h.cost + cost);
      emit({ time, type: 'fill', market: order.market, orderId: order.id, quantity,
        price: order.limit, message: `${order.market} / ${order.id}: bought ${quantity} share${quantity === 1 ? '' : 's'} at ${(order.limit * 100).toFixed(1)}¢ because an eligible ${volume}-share trade filled ${participation * 100}% participation${quantity < Math.floor(volume * participation + 1e-9) ? ', capped by the remaining order' : ''}. ${order.remaining ? `${order.remaining} still trying.` : 'Order complete.'} Now holding ${h.shares} shares in total${h.shares === 20 ? ' from completed orders of at most 10 shares, never one 20-share order' : ''}.` });
    }
    // Deliberately later in this step: payout can fund only a future quote.
    markets.forEach((m, i) => {
      const settlement = i === markets.length - 1 ? 110 : 85 + (i % 3) * 2;
      const h = holdings[i]!;
      if (time !== settlement || h.settled) return;
      const payout = m.wins ? h.shares : 0;
      cash = money(cash + payout);
      h.settled = true;
      emit({ time, type: 'settle', market: m.name, orderId: '', quantity: h.shares,
        price: m.wins ? 1 : 0, message: `${m.name}: ${h.shares} held shares settle at $${m.wins ? '1' : '0'}; $${payout.toFixed(2)} received. No early sale.` });
    });
    const reserved = money(reservedNow());
    snapshots.push({
      time, cash, reserved, available: money(Math.max(0, cash - reserved)),
      shares: holdings.filter(h => !h.settled).reduce((sum, h) => sum + h.shares, 0),
      orders: orders.map(o => ({ ...o })),
      holdings: holdings.map(h => ({ ...h })),
      events: events.map(e => ({ ...e })),
    });
  }
  return { duration, events, snapshots };
}
