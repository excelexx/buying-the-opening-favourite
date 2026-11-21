import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { Scenario, SimulationEvent, SimulationSnapshot } from '@/lib/simulation';
import { milestones, storyDate, explainOrder, marketSummary, filledOf, ORDER_LIFE } from '@/lib/story';

type R = {
  scenario: Scenario; setScenario: (s: Scenario) => void;
  run: { duration: number; events: SimulationEvent[]; snapshots: SimulationSnapshot[] };
  time: number; setTime: (t: number) => void; playing: boolean; setPlaying: (p: boolean) => void;
  speed: number; setSpeed: (s: number) => void; snap: SimulationSnapshot | null; restart: () => void;
  market: string; setMarket: (m: string) => void;
};

const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toneColor = { live: 'hsl(var(--brass))', filled: 'hsl(var(--no))', partial: 'hsl(var(--yes))', expired: 'hsl(var(--muted-foreground))' };
const toneLabel = { live: 'Trying', filled: 'Filled', partial: 'Partial', expired: 'Expired' };

function Trying() {
  return (
    <span className="relative inline-flex h-5 w-5 items-center justify-center" aria-hidden>
      <motion.span className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'hsl(var(--brass))' }} animate={{ scale: [0.6, 1.4], opacity: [0.9, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />
      <motion.span className="absolute h-5 w-5" animate={{ rotate: 360 }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}>
        <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full" style={{ background: 'hsl(var(--yes))' }} />
      </motion.span>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'hsl(var(--ink))' }} />
    </span>
  );
}

function eventText(e: SimulationEvent) {
  if (e.type === 'expire') return e.quantity > 0 && e.message ? e.message : e.message || 'No shares bought: no eligible trade filled the order.';
  return e.message;
}

export function ReplayPanel({ r }: { r: R }) {
  const s = r.snap;
  const allMarkets = useMemo(() => {
    const last = r.run.snapshots[r.run.snapshots.length - 1];
    return last ? last.holdings.map((h) => h.market) : [];
  }, [r.run]);
  const sum = s ? marketSummary(s, r.market) : null;
  const live = sum?.orders.find((o) => o.status === 'live');
  const recent = s ? s.events.filter((e) => e.type !== 'quote').slice(-8).reverse() : [];
  const date = storyDate(r.time);
  const nextMs = milestones.find((m) => m.time > r.time);
  const curMs = [...milestones].reverse().find((m) => m.time <= r.time);

  return (
    <div className="mt-3 space-y-3 pb-2" data-testid="panel-replay">
      <div className="flex flex-wrap gap-1.5">
        {(['normal', 'stressed'] as Scenario[]).map((sc) => (
          <button key={sc} className="ink-btn" data-on={r.scenario === sc} onClick={() => r.setScenario(sc)} data-testid={`button-scenario-${sc}`}>{sc}</button>
        ))}
        <button className="ink-btn" aria-label={r.playing ? 'Pause replay' : 'Play replay'} onClick={() => { if (r.time >= r.run.duration) r.restart(); else r.setPlaying(!r.playing); }} data-testid="button-replay-play">{r.playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <button className="ink-btn" aria-label="Restart replay" onClick={r.restart} data-testid="button-replay-restart"><RotateCcw size={14} /></button>
        {[0.25, 0.5, 1, 2].map((sp) => <button key={sp} className="ink-btn" data-on={r.speed === sp} onClick={() => r.setSpeed(sp)} data-testid={`button-speed-${sp}`}>{sp}x</button>)}
      </div>

      {/* Dated timeline */}
      <div>
        <div className="flex items-end justify-between">
          <div>
            <div className="font-serif text-3xl leading-none" data-testid="text-story-date">{date}</div>
            <div className="mt-1 text-xs opacity-75">{curMs?.detail}</div>
          </div>
          <div className="text-right font-mono text-[10px] uppercase tracking-widest opacity-60">
            replay {r.time.toFixed(0)}s / {r.run.duration}s<br />{nextMs ? `next: ${nextMs.label}` : 'end'}
          </div>
        </div>
        <div className="relative mt-3">
          <input className="scrub" aria-label="Replay time" type="range" min={0} max={r.run.duration} step={0.1} value={r.time} onChange={(e) => r.setTime(Number(e.target.value))} data-testid="input-scrub" />
          <div className="mt-1 grid grid-cols-7 gap-1">
            {milestones.map((m) => {
              const on = curMs?.label === m.label;
              return (
                <button key={m.label} onClick={() => r.setTime(m.time)} title={m.detail}
                  className="border-t border-current py-1 font-mono text-[9px] uppercase leading-tight tracking-wider transition-opacity hover:opacity-100"
                  style={{ opacity: on ? 1 : 0.55, color: on ? 'hsl(var(--yes))' : undefined }}
                  data-testid={`button-date-${m.label.replace(/\s/g, '')}`}>
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[10.5px] leading-snug opacity-65">Fictional Nov 1–13 dates are compressed into this replay. Order age uses separate replay seconds: unfilled orders expire at 30 seconds or earlier window closure, not after days. Playback speed scales the replay clock.</p>
      </div>

      {/* Market drilldown */}
      <div className="border border-foreground/20 bg-card/70 p-3 backdrop-blur-sm" data-testid="card-market">
        <div className="flex items-center justify-between gap-2">
          <select value={r.market} onChange={(e) => r.setMarket(e.target.value)} className="min-w-0 flex-1 border border-foreground/25 bg-transparent px-2 py-1 font-serif text-lg" data-testid="select-market">
            {allMarkets.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {sum?.holding && <span className="font-mono text-xs font-semibold" style={{ color: sum.holding.side === 'YES' ? 'hsl(var(--yes))' : 'hsl(var(--no))' }}>{sum.holding.side}</span>}
        </div>
        {sum && (
          <>
            <div className="mt-3 grid grid-cols-4 gap-2 font-mono">
              {[['Held', String(sum.holding?.settled ? 0 : sum.holding?.shares ?? 0)], ['Attempted', String(sum.attempted)], ['Filled', String(sum.filled)], ['Cost', money(sum.holding?.cost ?? 0)]].map(([k, v]) => (
                <div key={k} className="border-t-2 border-foreground pt-1"><div className="text-[9px] uppercase tracking-widest opacity-60">{k}</div><div className="text-sm font-semibold" data-testid={`text-market-${k.toLowerCase()}`}>{v}</div></div>
              ))}
            </div>
            <p className="mt-2 text-xs leading-snug" data-testid="text-market-why">
              {(sum.holding?.shares ?? 0) > 0
                ? <>{sum.holding?.settled ? 'Acquired' : 'Holds'} <b>{sum.holding?.shares} shares</b> from {sum.why}.{sum.holding?.settled ? ' All settled; no shares remain held.' : ' Held until settlement.'}</>
                : sum.orders.length ? <>No shares held yet: {sum.why}.</> : <>No order yet. Buying starts when this market's window opens and a usable quote arrives.</>}
            </p>
            <AnimatePresence>
              {live && (() => {
                const x = explainOrder(live, r.time);
                const pct = Math.min(1, (r.time - live.submittedAt) / ORDER_LIFE);
                return (
                  <motion.div key={live.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 border-l-4 p-2" style={{ borderColor: 'hsl(var(--brass))', background: 'hsl(var(--brass)/.1)' }} data-testid="status-trying">
                    <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-widest"><Trying /> Trying <span className="ml-auto">{x.left}s left</span></div>
                    <div className="mt-1 text-sm font-semibold">{x.head}</div>
                    <div className="text-xs opacity-80">{x.text}</div>
                    <div className="mt-2 flex h-2 w-full overflow-hidden bg-foreground/10">
                      <div style={{ width: `${(filledOf(live) / live.quantity) * 100}%`, background: 'hsl(var(--no))' }} />
                      <motion.div className="h-full" style={{ width: `${(live.remaining / live.quantity) * 100}%`, background: 'hsl(var(--brass)/.5)' }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }} />
                    </div>
                    <div className="mt-1 h-0.5 bg-foreground/10"><div className="h-full" style={{ width: `${pct * 100}%`, background: 'hsl(var(--yes))' }} /></div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
            <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto pr-1" data-testid="list-market-orders">
              {[...sum.orders].reverse().filter((o) => o.status !== 'live').map((o) => {
                const x = explainOrder(o, r.time);
                return (
                  <motion.div key={o.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: x.tone === 'expired' ? 0.75 : 1, x: 0 }} className="flex gap-2 border-t border-foreground/10 pt-1.5 text-xs" data-testid={`row-order-${o.id}`}>
                    <span className="w-14 shrink-0 font-mono text-[9px] font-semibold uppercase tracking-wider" style={{ color: toneColor[x.tone] }}>{toneLabel[x.tone]}</span>
                    <span className="w-12 shrink-0 font-mono text-[10px] opacity-60">{storyDate(o.submittedAt)}</span>
                    <span><b>{x.head}.</b> {x.text}</span>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {s && (
        <div className="grid grid-cols-4 gap-2 font-mono">
          {[['Cash', money(s.cash)], ['Reserved', money(s.reserved)], ['Available', money(s.available)], ['All shares', String(s.shares)]].map(([k, v]) => (
            <div key={k} className="border-t border-foreground/40 pt-1"><div className="text-[9px] uppercase tracking-widest opacity-60">{k}</div><div className="text-xs font-semibold" data-testid={`text-metric-${k.toLowerCase().replace(' ', '-')}`}>{v}</div></div>
          ))}
        </div>
      )}

      <div>
        <div className="kicker mb-1">All markets, latest first</div>
        <div className="max-h-40 space-y-0 overflow-y-auto pr-1 text-[11.5px]" data-testid="list-events">
          {recent.map((e) => (
            <button key={e.orderId + e.time + e.type + e.market} onClick={() => e.market && r.setMarket(e.market)} className="flex w-full gap-2 border-t border-foreground/10 py-1 text-left hover:bg-foreground/5">
              <span className="w-12 shrink-0 font-mono opacity-50">{storyDate(e.time)}</span>
              <span className="w-12 shrink-0 font-mono uppercase" style={{ color: e.type === 'fill' || e.type === 'settle' ? 'hsl(var(--no))' : e.type === 'expire' || e.type === 'skip' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--yes))' }}>{e.type === 'submit' ? 'try' : e.type}</span>
              <span className="flex-1"><span className="font-semibold">{e.market}:</span> {eventText(e)}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] leading-snug opacity-60">Synthetic illustrative inputs, not historical fills. Demo fees use an illustrative rounded taker curve, not historical dated fees; the saved results earlier in this film include dated exchange fees.</p>
    </div>
  );
}
