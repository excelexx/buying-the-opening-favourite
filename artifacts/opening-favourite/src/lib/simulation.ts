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
  { time: 0, label: 'Nov 1', detail: 'Alice: buying window opens' },
  { time: 15, label: 'Nov 2', detail: 'Alice: orders keep trying' },
  { time: 30, label: 'Nov 3', detail: 'Bob: buying window opens' },
  { time: 45, label: 'Nov 4', detail: 'Alice: vote / close; hold until settlement' },
  { time: 60, label: 'Nov 5', detail: 'Alice settles; Carol opens' },
  { time: 75, label: 'Nov 6', detail: 'Bob: vote / close; hold until settlement' },
  { time: 90, label: 'Nov 7', detail: 'Bob settles' },
  { time: 105, label: 'Nov 8', detail: 'Carol: vote / close; hold until settlement' },
  { time: 120, label: 'Nov 9', detail: 'Carol: waiting for settlement' },
  { time: 135, label: 'Nov 10', detail: 'Carol settles; all markets complete' },
];

export const marketWindows = [
  { name: 'Alice wins', side: 'YES' as const, bid: 0.62, ask: 0.64, wins: true,
    opening: 0, close: 45, settlement: 60 },
  { name: 'Bob wins', side: 'NO' as const, bid: 0.71, ask: 0.73, wins: false,
    opening: 30, close: 75, settlement: 90 },
  { name: 'Carol wins', side: 'YES' as const, bid: 0.66, ask: 0.68, wins: true,
    opening: 60, close: 105, settlement: 135 },
];

export function storyDate(time: number): string {
  return [...timelineMilestones].reverse().find(point => time >= point.time)?.label ?? 'Nov 1';
}

export function simulate(scenario: Scenario): {
  duration: number; events: SimulationEvent[]; snapshots: SimulationSnapshot[];
} {
  const duration = 144;
  const delay = scenario === 'normal' ? 2 : 5;
  const participation = scenario === 'normal' ? 0.025 : 0.01;
  const extra = scenario === 'normal' ? 0.001 : 0.011;
  const money = (n: number) => Math.round(n * 1e8) / 1e8;
  const markets = marketWindows;
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
      const { opening, close } = m;
      const h = holdings[i]!;
      if (time < opening || time >= close || h.settled) return [];
      if (time === opening) {
        emit({ time, type: 'quote', market: m.name, orderId: '', quantity: 0,
          price: m.ask, message: `${m.name}: opening midpoint selects ${m.side}; side remains fixed.` });
      }
      if (time === 0) return [];
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
    for (const order of orders.filter(o => o.status === 'live')) {
      const marketIndex = markets.findIndex(m => m.name === order.market);
      const close = markets[marketIndex]!.close;
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
      // Bob has no eligible tape activity until t=65, intentionally demonstrating
      // expiry. All synthetic quotes refresh each second, so quote age is zero.
      if (marketIndex === 1 && time < 65) continue;
      // The fictional tape dries up after these holdings; the strategy keeps
      // attempting orders until closure, but cannot buy without eligible trades.
      const tapeLiquidity = [30, 20, 40][marketIndex]!;
      if (holdings[marketIndex]!.shares >= tapeLiquidity) continue;
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
      const settlement = m.settlement;
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
