import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, RotateCcw, FileText, Github, BookOpen } from 'lucide-react';
import { ReplayPanel } from '@/components/ReplayPanel';
import { chapters, results, fillExample, aliceBob, discount } from '@/deck';
import { simulate, type Scenario, type SimulationSnapshot } from '@/lib/simulation';

const Scene = lazy(() => import('@/components/Scene'));
const BASE = import.meta.env.BASE_URL;
const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

function Extra({ id, replay }: { id: string; replay: ReturnType<typeof useReplay> }) {
  if (id === 'results') return (
    <table className="mt-5 w-full font-mono text-xs" data-testid="table-results">
      <thead><tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground"><th className="pb-2">Period</th><th style={{ color: 'hsl(var(--yes))' }}>Normal</th><th style={{ color: 'hsl(var(--no))' }}>Stressed</th></tr></thead>
      <tbody>{results.map((r) => (
        <tr key={r.label} className="border-t border-foreground/15"><td className="py-1.5">{r.label === '2024-26' ? '2024-26 continuous' : r.label + ' only'}</td><td>+{money(r.normal)} <span className="opacity-60">{r.np}%</span></td><td>+{money(r.stressed)} <span className="opacity-60">{r.sp}%</span></td></tr>
      ))}</tbody>
    </table>
  );
  if (id === 'trigger') return (
    <div className="mt-5 space-y-1 font-mono text-xs">{fillExample.map((r, i) => (
      <motion.div key={r.t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.5 }} className="grid grid-cols-[5.5rem_1fr_2.5rem] gap-2 border-t border-foreground/15 py-1.5">
        <span className="text-primary">{r.t}</span><span>{r.what}</span><span className="text-right font-semibold">{r.held}</span>
      </motion.div>))}</div>
  );
  if (id === 'alice') return (
    <div className="mt-5 grid grid-cols-[3.5rem_1fr_1fr] gap-x-3 font-mono text-[11px]">
      <span /><span style={{ color: 'hsl(var(--yes))' }}>YES on Alice</span><span style={{ color: 'hsl(var(--no))' }}>NO on Bob</span>
      {aliceBob.map((r, i) => (
        <motion.div key={r.d} className="contents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.35 }}>
          <span className="border-t border-foreground/15 py-1 opacity-60">{r.d}</span><span className="border-t border-foreground/15 py-1">{r.a}</span><span className="border-t border-foreground/15 py-1">{r.b}</span>
        </motion.div>))}
      <p className="col-span-3 mt-2 opacity-60">Fictional example. Dates are snapshots; buying continues between them.</p>
    </div>
  );
  if (id === 'appendix') return (
    <div className="mt-5 font-mono text-xs">{discount.map((d) => (
      <div key={d.label} className="grid grid-cols-[1fr_5rem_5rem] border-t border-foreground/15 py-1.5"><span>{d.label}</span><span>{money(d.normal)}</span><span className="opacity-70">{money(d.stressed)}</span></div>))}
      <p className="mt-2 opacity-60">Normal / stressed net paper profit. The simulator and all main results use immediate buying only.</p>
    </div>
  );
  if (id === 'sources') return (
    <div className="mt-5 flex flex-wrap gap-2">
      <a className="ink-btn" href={`${BASE}source/strategy.pdf`} target="_blank" rel="noreferrer" data-testid="link-pdf"><FileText size={14} /> Original deck PDF</a>
      <a className="ink-btn" href="https://github.com/excelexx/buying-the-opening-favourite" target="_blank" rel="noreferrer" data-testid="link-github"><Github size={14} /> Repository (private)</a>
    </div>
  );
  if (id === 'replay') return <ReplayPanel r={replay} />;
  return null;
}

function App() {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(false);
  const [full, setFull] = useState(false);
  const [showSrc, setShowSrc] = useState(false);
  const webgl = useMemo(hasWebGL, []);
  const replay = useReplay();
  const ch = chapters[index];
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
    const t = setTimeout(() => go(1), ch.dwell * 1000);
    return () => clearTimeout(t);
  }, [auto, index, ch.dwell, go]);

  useEffect(() => { if (ch.id === 'replay') replay.restart(); }, [ch.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }

  const right = ch.align === 'right';
  const wide = ['results', 'trigger', 'alice', 'appendix'].includes(ch.id);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0">
        {webgl ? <Suspense fallback={<div className="h-full w-full bg-background" />}><Scene index={index} snap={replay.snap} selected={replay.market} time={replay.time} /></Suspense>
          : <div className="h-full w-full" style={{ background: 'radial-gradient(circle at 70% 40%, hsl(var(--yes)/.25), transparent 50%), radial-gradient(circle at 30% 70%, hsl(var(--no)/.25), transparent 50%), hsl(var(--background))' }} data-testid="fallback-webgl" />}
      </div>
      <div className="pointer-events-none absolute inset-0" style={{ background: right ? 'linear-gradient(270deg, hsl(var(--background)/.92) 0%, hsl(var(--background)/.6) 38%, transparent 62%)' : 'linear-gradient(90deg, hsl(var(--background)/.92) 0%, hsl(var(--background)/.6) 38%, transparent 62%)' }} />

      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-5 py-4 md:px-10">
        <div className="font-serif text-lg italic">Opening Favourite</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] opacity-60" data-testid="text-chapter-count">{String(index + 1).padStart(2, '0')} / {chapters.length}</div>
      </header>

      <AnimatePresence mode="wait">
        <motion.section key={ch.id}
          initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.1, 1] }}
          className={`absolute top-16 bottom-24 z-10 flex flex-col justify-center overflow-y-auto px-5 md:px-12 ${ch.id === 'replay' ? 'md:w-[620px] justify-start' : wide ? 'md:w-[540px]' : 'md:w-[500px]'} w-full ${right ? 'md:right-0' : 'md:left-0'}`}
          data-testid={`section-${ch.id}`}>
          <div className="kicker">{ch.kicker}</div>
          <h1 className={`mt-3 font-serif font-light leading-[0.95] tracking-tight ${index === 0 ? 'text-5xl md:text-7xl' : 'text-4xl md:text-5xl'}`}>{ch.title}</h1>
          {index === 0 && (
            <div className="mt-6 flex items-baseline gap-4">
              <span className="font-serif text-6xl font-bold" style={{ color: 'hsl(var(--yes))' }}>$301.55</span>
              <span className="font-mono text-sm">30.16% return<br /><span className="opacity-60">normal net paper profit, one $1,000 account</span></span>
            </div>
          )}
          <div className="mt-5 space-y-3 text-[15px] leading-relaxed opacity-85">
            {ch.id === 'limits' ? <ol className="space-y-2">{ch.body.map((b, i) => <li key={i} className="flex gap-3"><span className="font-mono text-primary">0{i + 1}</span>{b}</li>)}</ol> : ch.body.map((b, i) => <p key={i}>{b}</p>)}
          </div>
          {ch.facts && (
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              {ch.facts.map((f, i) => (
                <motion.div key={f.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.12 }}>
                  <div className="font-mono text-[10px] uppercase tracking-widest opacity-60">{f.k}</div>
                  <div className="font-serif text-2xl">{f.v}</div>
                </motion.div>
              ))}
            </div>
          )}
          <Extra id={ch.id} replay={replay} />
        </motion.section>
      </AnimatePresence>

      <AnimatePresence>
        {showSrc && (
          <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} className="absolute right-4 top-16 z-30 w-[min(380px,calc(100%-2rem))] border border-foreground/20 bg-card/95 p-5 text-sm backdrop-blur" data-testid="panel-source">
            <div className="kicker">Source details</div>
            <ul className="mt-3 space-y-2 opacity-85">
              <li>Fixed retrospective universe: 1,780 scheduled opportunities, 52 voting dates, 530 listed; purchases in 285 (normal) / 279 (stressed).</li>
              <li>Cut-off 20 Nov 2026 00:00 UTC. Cumulative, not annualised. Annual runs each start fresh at $1,000.</li>
              <li>Hypothetical execution; no guaranteed queue position; not live trading.</li>
              <li>Replay events are synthetic. Fictional calendar dates are compressed (Nov 1 to Nov 13 in 110 replay seconds). Order ages use replay seconds; orders expire after 30 or earlier window closure. Demo fees use an illustrative rounded taker curve, not historical dated fees; the saved results do include dated exchange fees.</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <a className="ink-btn" href={`${BASE}source/strategy.pdf`} target="_blank" rel="noreferrer" data-testid="link-source-pdf"><FileText size={14} /> PDF</a>
              <a className="ink-btn" href="https://github.com/excelexx/buying-the-opening-favourite" target="_blank" rel="noreferrer" data-testid="link-source-github"><Github size={14} /> GitHub (private)</a>
            </div>
          </motion.aside>
        )}
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
          <div className="hidden font-mono text-[10px] uppercase tracking-widest opacity-50 md:block">Arrows navigate / P present / F fullscreen</div>
          <div className="flex gap-1.5">
            <button className="ink-btn" data-on={showSrc} onClick={() => setShowSrc((s) => !s)} data-testid="button-sources"><BookOpen size={14} /><span className="hidden sm:inline">Sources</span></button>
            <button className="ink-btn" onClick={toggleFull} data-testid="button-fullscreen">{full ? <Minimize size={14} /> : <Maximize size={14} />}</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
