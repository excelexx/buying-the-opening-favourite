import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { marketWindows, type Scenario, type SimulationEvent, type SimulationSnapshot } from '@/lib/simulation';
import { milestones, storyDate, explainOrder, marketSummary, marketState, filledOf, ORDER_LIFE } from '@/lib/story';

type R = {
  scenario: Scenario; setScenario: (s: Scenario) => void;
  run: { duration: number; events: SimulationEvent[]; snapshots: SimulationSnapshot[] };
  time: number; setTime: (t: number) => void; playing: boolean; setPlaying: (p: boolean) => void;
  speed: number; setSpeed: (s: number) => void; snap: SimulationSnapshot | null; restart: () => void;
  market: string; setMarket: (m: string) => void;
};

const stateColor: Record<string, string> = {
  'not started': 'hsl(var(--muted-foreground))', buying: 'hsl(var(--brass))', holding: 'hsl(var(--no))', settled: 'hsl(var(--yes))',
};

function Trying() {
  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center" aria-hidden>
      <motion.span className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'hsl(var(--brass))' }} animate={{ scale: [0.6, 1.4], opacity: [0.9, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'hsl(var(--ink))' }} />
    </span>
  );
}

export function ReplayPanel({ r }: { r: R }) {
  const s = r.snap;
  const t = r.time;
  const curMs = [...milestones].reverse().find((m) => m.time <= t);

  return (
    <div className="mt-4 space-y-3 pb-2" data-testid="panel-replay">
      <div className="flex flex-wrap gap-1.5">
        {(['normal', 'stressed'] as Scenario[]).map((sc) => (
          <button key={sc} className="ink-btn" data-on={r.scenario === sc} onClick={() => r.setScenario(sc)} data-testid={`button-scenario-${sc}`}>{sc}</button>
        ))}
        <button className="ink-btn" aria-label={r.playing ? 'Pause' : 'Play'} onClick={() => { if (t >= r.run.duration) r.restart(); else r.setPlaying(!r.playing); }} data-testid="button-replay-play">{r.playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <button className="ink-btn" aria-label="Restart" onClick={r.restart} data-testid="button-replay-restart"><RotateCcw size={14} /></button>
        {[0.5, 1, 2, 4].map((sp) => <button key={sp} className="ink-btn" data-on={r.speed === sp} onClick={() => r.setSpeed(sp)} data-testid={`button-speed-${sp}`}>{sp}x</button>)}
      </div>

      <div>
        <div className="flex items-end justify-between">
          <div>
            <div className="font-serif text-3xl leading-none" data-testid="text-story-date">{storyDate(t)}</div>
            <div className="mt-1 text-xs opacity-75">{t >= r.run.duration ? 'Finished: all three markets settled.' : curMs?.detail}</div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest opacity-60">{t.toFixed(0)}s / {r.run.duration}s</div>
        </div>
        <input className="scrub mt-3" aria-label="Replay time" type="range" min={0} max={r.run.duration} step={0.1} value={t}
          onChange={(e) => { r.setPlaying(false); r.setTime(Number(e.target.value)); }} data-testid="input-scrub" />
        <div className="mt-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0,1fr))` }}>
          {milestones.map((m) => (
            <button key={m.label} onClick={() => { r.setPlaying(false); r.setTime(m === milestones[milestones.length - 1] ? r.run.duration : m.time); }} title={m.detail}
              className="border-t border-current py-1 font-mono text-[8.5px] uppercase tracking-wider"
              style={{ opacity: curMs?.label === m.label ? 1 : 0.5, color: curMs?.label === m.label ? 'hsl(var(--yes))' : undefined }}
              data-testid={`button-date-${m.label.replace(/\s/g, '')}`}>{m.label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {marketWindows.map((w) => {
          const st = marketState(w.name, t);
          const sum = s ? marketSummary(s, w.name) : null;
          const held = sum?.holding?.shares ?? 0;
          const last = sum?.orders[sum.orders.length - 1];
          const live = sum?.orders.find((o) => o.status === 'live');
          const x = last ? explainOrder(last, t) : null;
          const sel = r.market === w.name;
          let line: string;
          if (st === 'not started') line = `Buying opens ${storyDate(w.opening)}.`;
          else if (st === 'settled') line = `Settled ${storyDate(w.settlement)}: ${held} shares, ${w.wins ? `$${held} paid` : '$0 paid'}.`;
          else if (st === 'holding') line = `Vote / close ${storyDate(w.close)}. Holding ${held} shares until ${storyDate(w.settlement)}.`;
          else line = x ? `${x.head}. ${x.text}` : 'Waiting for the first usable quote.';
          return (
            <button key={w.name} onClick={() => r.setMarket(w.name)} className="block w-full border bg-card/70 p-2.5 text-left backdrop-blur-sm transition-colors"
              style={{ borderColor: sel ? 'hsl(var(--yes))' : 'hsl(var(--foreground)/.2)' }} data-testid={`card-market-${w.name.split(' ')[0].toLowerCase()}`}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold" style={{ color: w.side === 'YES' ? 'hsl(var(--yes))' : 'hsl(var(--no))' }}>{w.side}</span>
                <span className="font-serif text-base">{w.name.replace(' wins', '')}</span>
                <span className="font-mono text-[9px] opacity-55">{storyDate(w.opening)} – {storyDate(w.close)} · settles {storyDate(w.settlement)}</span>
                <span className="ml-auto flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-widest" style={{ color: stateColor[st] }} data-testid={`status-${w.name.split(' ')[0].toLowerCase()}`}>
                  {live && st === 'buying' && <Trying />}{live && st === 'buying' ? 'trying' : st}
                </span>
                <span className="w-12 text-right font-mono text-xs font-semibold">{st === 'settled' ? 0 : held} sh</span>
              </div>
              <div className="mt-1 text-[11.5px] leading-snug opacity-80">{line}</div>
              {live && st === 'buying' && (
                <div className="mt-1.5 flex h-1.5 w-full overflow-hidden bg-foreground/10">
                  <div style={{ width: `${(filledOf(live) / live.quantity) * 100}%`, background: 'hsl(var(--no))' }} />
                  <div style={{ width: `${Math.min(1, (t - live.submittedAt) / ORDER_LIFE) * (live.remaining / live.quantity) * 100}%`, background: 'hsl(var(--brass)/.6)' }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] opacity-55">Illustrative replay. Dates are compressed; order age uses replay seconds.</p>
    </div>
  );
}
