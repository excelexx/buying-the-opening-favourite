import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, FileText } from 'lucide-react';
import { ReplayPanel } from '@/components/ReplayPanel';
import { chapters, types, buyingSteps, normalRows, stressedRows, startChart, fillExample, discount } from '@/deck';
import { simulate, type Scenario, type SimulationSnapshot } from '@/lib/simulation';

const Scene = lazy(() => import('@/components/Scene'));
const BASE = import.meta.env.BASE_URL;

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export function useReplay() {
  const [scenario, setScenario] = useState<Scenario>('normal');
  const run = useMemo(() => simulate(scenario), [scenario]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) { last.current = null; return; }
    let raf = 0;
    const tick = (now: number) => {
      if (last.current != null) {
        const dt = (now - last.current) / 1000;
        setTime((t) => { const n = t + dt * speed; if (n >= run.duration) { setPlaying(false); return run.duration; } return n; });
      }
      last.current = now; raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, run.duration]);
  const [market, setMarket] = useState('Alice wins');
  const snap: SimulationSnapshot | null = run.snapshots[Math.min(run.snapshots.length - 1, Math.floor(time))] ?? null;
  return {
    scenario, setScenario: (s: Scenario) => { setScenario(s); setTime(0); setPlaying(true); },
    run, time, setTime, market, setMarket, playing, setPlaying, speed, setSpeed, snap,
    restart: () => { setTime(0); setPlaying(true); },
  };
}

const T = 'mt-5 w-full font-mono text-xs';
function Table({ rows, head }: { rows: { p: string; v: string; r: string }[]; head: string }) {
  return (
    <table className={T}>
      <thead><tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground"><th className="pb-2">Period</th><th>{head}</th><th>Return on $1,000</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <motion.tr key={r.p} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.15 }} className="border-t border-foreground/15"><td className="py-1.5">{r.p}</td><td className="font-semibold">{r.v}</td><td>{r.r}</td></motion.tr>
      ))}</tbody>
    </table>
  );
}
const Foot = ({ children }: { children: React.ReactNode }) => <p className="mt-3 text-[12px] leading-snug opacity-65">{children}</p>;

function Body({ id, replay }: { id: string; replay: ReturnType<typeof useReplay> }) {
  const lead = (t: string) => <p className="mt-4 text-[15px] leading-relaxed opacity-85">{t}</p>;
  switch (id) {
    case 'open': return (
      <div className="mt-6">
        <div className="font-serif text-6xl font-bold" style={{ color: 'hsl(var(--yes))' }}>$301.55</div>
        <div className="mt-2 font-mono text-sm">30.16% return</div>
        <div className="mt-1 text-[15px] opacity-85">Normal net paper profit across 2024–2026</div>
        <div className="mt-1 text-[15px] opacity-65">One $1,000 starting account across 52 voting dates.</div>
      </div>);
    case 'types': return (
      <div><ul className="mt-5 space-y-1.5 text-[15px]">{types.map((t, i) => <motion.li key={t} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="border-t border-foreground/15 pt-1.5">{t}</motion.li>)}</ul>
        {lead('Buy the YES or NO side with the higher market probability of winning.')}</div>);
    case 'buying': return (
      <div>{lead('Every contract uses the same cash account. Each becomes active three days before its own voting date.')}
        <ol className="mt-4 space-y-2.5 text-[14px] leading-snug">{buyingSteps.map((b, i) => <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.15 }} className="flex gap-3"><span className="font-mono text-primary">{i + 1}</span><span>{b}</span></motion.li>)}</ol>
        <Foot>The tested rule allows more purchases until two days after voting, unless the market closes earlier. Settled cash can fund later elections.</Foot></div>);
    case 'replay': return (
      <div>{lead('Orange and blue show when we can buy. This fictional example assumes each market closes on its voting day.')}
        <ReplayPanel r={replay} />
        <Foot>These dates are snapshots. Alice reaches 30 shares after two more 10-share orders fill. Bob reaches 20 after one more fills. We keep trying between snapshots.</Foot></div>);
    case 'trigger': return (
      <div>{lead('We try to buy at each usable quote when there is no live order, enough cash and room below the 100-share cap. Trades determine what fills.')}
        <div className="mt-4 font-mono text-xs">
          <div className="grid grid-cols-[5.5rem_1fr_4.5rem] gap-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground"><span>Example time</span><span>What happens</span><span className="text-right">Shares held</span></div>
          {fillExample.map((r, i) => (
            <motion.div key={r.t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.5 }} className="grid grid-cols-[5.5rem_1fr_4.5rem] gap-2 border-t border-foreground/15 py-1.5">
              <span className="text-primary">{r.t}</span><span>{r.what}</span><span className="text-right font-semibold">{r.held}</span>
            </motion.div>))}
        </div>
        <Foot>Normal fills take up to 2.5% of an eligible trade after a 2-second delay. An unfilled order expires after 30 seconds, freeing us to try at the next usable quote.</Foot></div>);
    case 'results': return (
      <div>{lead('Same strategy throughout. Buy the favored side immediately, keep buying within the window, then hold until settlement.')}
        <Table rows={normalRows} head="Normal net profit" />
        <Foot>Each annual row starts with $1,000 separately. The continuous run starts with $1,000 once and carries profits forward, so the annual rows do not add to its total.</Foot>
        <Foot>Normal fills assume a 2-second delay, up to 2.5% of an eligible trade and 0.1¢ extra cost per share, plus exchange fees. 2026 ends at the November 20 cutoff.</Foot></div>);
    case 'start': return (
      <div>{lead('Normal execution across 2024–2026. Each replay moves both the first observation and the first possible purchase to the indicated day.')}
        <div className="mt-5 flex h-40 items-end gap-3 md:hidden">{startChart.map((c) => <div key={c.label} className="flex flex-1 flex-col items-center gap-1 font-mono text-[10px]"><span>${c.v.toFixed(2)}</span><div className="w-full" style={{ height: `${(c.v / 320) * 100}px`, background: 'hsl(var(--yes))' }} /><span className="text-center">{c.label}</span></div>)}</div>
        {lead('Normal profit was $301.55 with a three-day start and $223.69 with a voting-day start.')}</div>);
    case 'stressed': return (
      <div>{lead('The same strategy with slower and smaller fills, and higher costs. “Stressed” describes the execution assumptions.')}
        <Table rows={stressedRows} head="Stressed net profit" />
        <Foot>Stressed fills wait 5 seconds, take up to 1% of an eligible trade and add 1.1¢ per share, plus exchange fees. Normal fills use 2 seconds, 2.5% and 0.1¢.</Foot>
        <Foot>Annual rows restart at $1,000. The continuous run carries cash forward. With starts 3, 2, 1 and 0 days before voting, stressed profits were $229.94, $111.09, $211.00 and $135.38.</Foot></div>);
    case 'appendix': return (
      <div>{lead('Both variants keep the same roster, opening side, $1,000 account and settlement rule. Only the entry price rule changes.')}
        <div className="mt-4 grid gap-4 text-[13px] sm:grid-cols-2">
          <div className="border-t-2 border-foreground pt-1.5"><div className="font-serif text-lg">Wait on every date</div><p className="opacity-80">Buy only when the ask plus estimated fees and trading costs falls below the chosen side’s opening midpoint.</p></div>
          <div className="border-t-2 border-foreground pt-1.5"><div className="font-serif text-lg">Wait except on general-election dates</div><p className="opacity-80">On regular federal general-election dates, buy immediately. On all other voting dates, require the same discount.</p></div>
        </div>
        <div className="mt-5 font-mono text-xs">
          <div className="grid grid-cols-[1fr_5rem_5rem] pb-1 text-[10px] uppercase tracking-widest text-muted-foreground"><span>Net paper profit</span><span>Normal</span><span>Stressed</span></div>
          {discount.map((d) => <div key={d.label} className="grid grid-cols-[1fr_5rem_5rem] border-t border-foreground/15 py-1.5"><span>{d.label}</span><span>{d.normal}</span><span>{d.stressed}</span></div>)}
        </div></div>);
    default: return null;
  }
}

function App() {
  const [index, setIndex] = useState(() => { const n = Number(new URLSearchParams(window.location.search).get('slide')); return n >= 1 && n <= chapters.length ? n - 1 : 0; });
  const [auto, setAuto] = useState(false);
  const [full, setFull] = useState(false);
  const webgl = useMemo(hasWebGL, []);
  const replay = useReplay();
  const ch = chapters[index];
  const replayDone = replay.time >= replay.run.duration;
  const go = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(chapters.length - 1, i + d))), []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      if (e.key === 'f') toggleFull();
      if (e.key === 'p') setAuto((a) => !a);
      if (e.key === 'Home') setIndex(0);
      if (e.key === 'End') setIndex(chapters.length - 1);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [go]);

  useEffect(() => {
    if (!auto) return;
    if (index >= chapters.length - 1) { setAuto(false); return; }
    if (ch.id === 'replay') { if (!replayDone) return; go(1); return; }
    const t = setTimeout(() => go(1), ch.dwell * 1000);
    return () => clearTimeout(t);
  }, [auto, index, ch.dwell, ch.id, replayDone, go]);

  useEffect(() => { if (ch.id === 'replay') replay.restart(); else replay.setPlaying(false); }, [ch.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }

  const right = ch.align === 'right';
  const wide = ['results', 'trigger', 'stressed', 'appendix'].includes(ch.id);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0">
        {webgl ? <Suspense fallback={<div className="h-full w-full bg-background" />}><Scene index={index} snap={replay.snap} selected={replay.market} time={replay.time} events={replay.run.events} duration={replay.run.duration} /></Suspense>
          : <div className="h-full w-full" style={{ background: 'radial-gradient(circle at 70% 40%, hsl(var(--yes)/.25), transparent 50%), radial-gradient(circle at 30% 70%, hsl(var(--no)/.25), transparent 50%), hsl(var(--background))' }} data-testid="fallback-webgl" />}
      </div>
      {ch.id !== 'replay' && <div className="pointer-events-none absolute inset-0" style={{ background: right ? 'linear-gradient(270deg, hsl(var(--background)/.92) 0%, hsl(var(--background)/.6) 38%, transparent 62%)' : 'linear-gradient(90deg, hsl(var(--background)/.92) 0%, hsl(var(--background)/.6) 38%, transparent 62%)' }} />}

      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-5 py-4 md:px-10">
        <div />
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] opacity-60" data-testid="text-chapter-count">{String(index + 1).padStart(2, '0')} / {chapters.length}</div>
      </header>

      <AnimatePresence mode="wait">
        {ch.id === 'replay' ? <motion.section key="replay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-10" data-testid="section-replay">
          <div className="pointer-events-auto absolute bottom-24 left-[15%] right-[15%]"><ReplayPanel r={replay} /></div>
        </motion.section> : <motion.section key={ch.id}
          initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.1, 1] }}
          className={`presentation-copy ${wide ? 'presentation-copy-wide' : ''} ${right ? 'copy-right' : 'copy-left'}`}
          data-testid={`section-${ch.id}`}>
          <h1 className={`font-serif font-light leading-[0.95] tracking-tight ${index === 0 ? 'text-5xl md:text-7xl' : 'text-3xl md:text-[2.6rem]'}`}>{ch.title}</h1>
          <Body id={ch.id} replay={replay} />
        </motion.section>}
      </AnimatePresence>

      <footer className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-4 md:px-10">
        <div className="mb-3 flex gap-1">
          {chapters.map((c, i) => (
            <button key={c.id} onClick={() => setIndex(i)} className="group h-3 flex-1" aria-label={c.title} data-testid={`button-chapter-${c.id}`}>
              <div className="h-[3px] w-full transition-colors" style={{ background: i === index ? 'hsl(var(--yes))' : i < index ? 'hsl(var(--ink))' : 'hsl(var(--ink)/.2)' }} />
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <button className="ink-btn" onClick={() => go(-1)} disabled={index === 0} data-testid="button-prev"><ChevronLeft size={16} /></button>
            <button className="ink-btn" onClick={() => go(1)} disabled={index === chapters.length - 1} data-testid="button-next"><ChevronRight size={16} /></button>
            <button className="ink-btn" data-on={auto} onClick={() => setAuto((a) => !a)} data-testid="button-autoplay">{auto ? <Pause size={14} /> : <Play size={14} />}<span className="hidden sm:inline">{auto ? 'Presenting' : 'Present'}</span></button>
          </div>
          <div className="flex gap-1.5">
            <a className="ink-btn" href={`${BASE}source/strategy.pdf`} target="_blank" rel="noreferrer" data-testid="link-pdf"><FileText size={14} /><span className="hidden sm:inline">PDF</span></a>
            <button className="ink-btn" onClick={toggleFull} data-testid="button-fullscreen">{full ? <Minimize size={14} /> : <Maximize size={14} />}</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
