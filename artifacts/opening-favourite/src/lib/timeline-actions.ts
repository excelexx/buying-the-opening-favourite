import { marketWindows, type SimulationSnapshot } from './simulation';

/** Short, lane-local explanations derived from the actual replay state. */
export function marketAction(snapshot: SimulationSnapshot | null, time: number, name: string): { text: string; trying: boolean; rejected?: boolean; animationKey?: string } | null {
  const market = marketWindows.find(m => m.name === name);
  if (!market || !snapshot || time < market.opening) return null;
  const holding = snapshot.holdings.find(h => h.market === name);
  const held = holding?.shares ?? 0;
  if (time >= market.settlement) return { text: `Settled · $${market.wins ? held : 0} paid`, trying: false };
  const recent = [...snapshot.events].reverse().find(e => e.market === name && e.type !== 'quote' && e.type !== 'submit' && time - e.time <= 3.5);
  if (recent?.type === 'fill') {
    const order = snapshot.orders.find(o => o.id === recent.orderId);
    const filled = snapshot.events.filter(e => e.type === 'fill' && e.orderId === recent.orderId && e.time <= recent.time).reduce((n, e) => n + e.quantity, 0);
    return { text: filled === order?.quantity ? `Order at $${recent.price.toFixed(2)} filled` : `${recent.quantity} shares filled at $${recent.price.toFixed(2)}`, trying: false };
  }
  if (recent?.type === 'expire') {
    const order = snapshot.orders.find(o => o.id === recent.orderId);
    const filled = order ? order.quantity - order.remaining : 0;
    return { text: filled ? `${filled} filled · ${recent.quantity} expired` : 'Unfilled · no shares bought', trying: false, rejected: true, animationKey: `expired-${recent.orderId}-${recent.time}` };
  }
  if (time >= market.close) return { text: `${held} held · awaiting settlement`, trying: false };
  const live = snapshot.orders.find(o => o.market === name && o.status === 'live');
  if (live) return { text: `Attempts to fill at $${live.limit.toFixed(2)}`, trying: true, animationKey: live.id };
  return held ? { text: `${held} shares held`, trying: false } : null;
}
