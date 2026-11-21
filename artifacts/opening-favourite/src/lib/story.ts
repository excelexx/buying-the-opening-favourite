import { timelineMilestones, storyDate as simulationDate } from '@/lib/simulation';
import type { SimulationOrder, SimulationSnapshot } from '@/lib/simulation';

export const milestones = timelineMilestones;
export function storyDate(t: number): string {
  return simulationDate(t);
}

export const ORDER_LIFE = 30;

export function filledOf(o: SimulationOrder) { return o.quantity - o.remaining; }

export function explainOrder(o: SimulationOrder, now: number) {
  const f = filledOf(o);
  const price = (o.limit * 100).toFixed(1) + 'c';
  if (o.status === 'live') {
    const left = Math.max(0, Math.ceil(o.submittedAt + ORDER_LIFE - now));
    return {
      tone: 'live' as const,
      head: `Trying to buy ${o.quantity} ${o.side} shares at ${price}`,
      text: f > 0
        ? `${f} filled so far from eligible trades; ${o.remaining} still waiting. Expires in ${left}s of order age if nothing else trades.`
        : `Nothing filled yet. Waiting for an eligible trade; expires in ${left}s of order age.`,
      left,
    };
  }
  if (o.status === 'filled') return { tone: 'filled' as const, head: `Bought ${o.quantity} shares at ${price}`, text: `The whole ${o.quantity}-share order was filled by eligible trades.`, left: 0 };
  const ending = o.endReason === 'window' ? 'when the buying window closed' : 'after 30s';
  if (f === 0) return { tone: 'expired' as const, head: 'No shares bought', text: `No eligible trade filled the order. The ${o.quantity}-share request at ${price} expired ${ending}.${o.endReason === 'window' ? ' No more buying in this market.' : ' The next usable quote can try again.'}`, left: 0 };
  return { tone: 'partial' as const, head: `Bought ${f} of ${o.quantity} shares`, text: `Partial fill kept: ${f} shares at ${price}. The remaining ${o.remaining} expired ${ending} and their reserved cash was released.`, left: 0 };
}

export function marketSummary(snap: SimulationSnapshot, market: string) {
  const orders = snap.orders.filter((o) => o.market === market).sort((a, b) => a.submittedAt - b.submittedAt);
  const attempted = orders.reduce((n, o) => n + o.quantity, 0);
  const filled = orders.reduce((n, o) => n + filledOf(o), 0);
  const full = orders.filter((o) => o.status === 'filled').length;
  const partial = orders.filter((o) => o.status === 'expired' && filledOf(o) > 0);
  const empty = orders.filter((o) => o.status === 'expired' && filledOf(o) === 0).length;
  const parts: string[] = [];
  if (full) parts.push(`${full} completed ${full === 1 ? 'order' : 'separate orders'} of up to 10 shares each${full > 1 ? ', not one big order' : ''}`);
  if (partial.length) parts.push(`${partial.length} partial ${partial.length === 1 ? 'fill' : 'fills'} (${partial.map(filledOf).join(' + ')} shares)`);
  const pendingFilled = orders.filter(o => o.status === 'live').reduce((n, o) => n + filledOf(o), 0);
  if (pendingFilled) parts.push(`${pendingFilled} shares already filled in the still-pending order`);
  if (empty) parts.push(`${empty} ${empty === 1 ? 'attempt' : 'attempts'} that bought nothing`);
  const holding = snap.holdings.find((h) => h.market === market);
  return { orders, attempted, filled, holding, why: parts.join(', ') };
}
