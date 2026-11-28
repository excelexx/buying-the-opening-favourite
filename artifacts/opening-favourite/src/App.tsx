import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, FileText, HelpCircle, LayoutGrid, Maximize, Minimize, Pause, Play, StickyNote } from 'lucide-react';
import { ReplayPanel } from '@/components/ReplayPanel';
import { Rail } from '@/components/Rail';
import { Help, Notes, Overview } from '@/components/Overlays';
import { OriginalChapter } from '@/chapters/Original';
import { allChapters, coreChapters, sections, stations, type Slide } from '@/deck';
import { simulate, type Scenario, type SimulationSnapshot } from '@/lib/simulation';

const Scene = lazy(() => import('@/components/Scene'));
// The math chapters carry the equation typesetter and the figures. They load after first paint.
const loadMath = () => import('@/chapters/MathChapters');
const MathChapter = lazy(() => loadMath().then((m) => ({ default: m.MathChapter })));
const BASE = import.meta.env.BASE_URL;
/** The embedded preview build has nowhere to open a PDF, so it hides the link. */
const SHOW_PDF = import.meta.env.VITE_HIDE_PDF !== '1';

/** `?clean=1` drops the controls, for screenshots and the PDF handout. */
const CLEAN = new URLSearchParams(window.location.search).get('clean') === '1';

type DeckMode = 'full' | 'core';

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

function remembered(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function remember(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* private mode or a sandboxed frame */ }
}

/** Where to open: a chapter named in the address, else the old ?slide=N link, else the title. */
function initialState(): { mode: DeckMode; id: string } {
  const params = new URLSearchParams(window.location.search);
  const named = allChapters.find((c) => c.id === window.location.hash.slice(1));
  let mode: DeckMode = params.get('deck') === 'core' || (params.get('deck') == null && remembered('deck') === 'core') ? 'core' : 'full';
  if (named) {
    if (!named.core) mode = 'full';
    return { mode, id: named.id };
  }
  const deck = mode === 'core' ? coreChapters : allChapters;
  const n = Number(params.get('slide'));
  return { mode, id: (n >= 1 && n <= deck.length ? deck[n - 1]! : deck[0]!).id };
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

function App() {
  const first = useMemo(initialState, []);
  const [mode, setMode] = useState<DeckMode>(first.mode);
  const [id, setId] = useState(first.id);
  const [auto, setAuto] = useState(false);
  const [full, setFull] = useState(false);
  const [sheet, setSheet] = useState<'overview' | 'help' | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const webgl = useMemo(hasWebGL, []);
  const replay = useReplay();

  const deck = mode === 'core' ? coreChapters : allChapters;
  const index = Math.max(0, deck.findIndex((c) => c.id === id));
  const ch: Slide = deck[index]!;
  const replayDone = replay.time >= replay.run.duration;

  const goTo = useCallback((i: number) => setId((cur) => {
    const list = mode === 'core' ? coreChapters : allChapters;
    return (list[Math.max(0, Math.min(list.length - 1, i))] ?? list[0]!).id ?? cur;
  }), [mode]);
  const go = useCallback((d: number) => setId((cur) => {
    const list = mode === 'core' ? coreChapters : allChapters;
    const at = Math.max(0, list.findIndex((c) => c.id === cur));
    return list[Math.max(0, Math.min(list.length - 1, at + d))]!.id;
  }), [mode]);

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next: DeckMode = m === 'full' ? 'core' : 'full';
      remember('deck', next);
      if (next === 'core') {
        // Step back to the nearest chapter of the original deck.
        setId((cur) => {
          const at = allChapters.findIndex((c) => c.id === cur);
          for (let i = at; i >= 0; i--) if (allChapters[i]!.core) return allChapters[i]!.id;
          return coreChapters[0]!.id;
        });
      }
      return next;
    });
  }, []);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  // Keep the address in step with the chapter, and follow edits to it.
  useEffect(() => {
    try { if (window.location.hash.slice(1) !== id) window.history.replaceState(null, '', `#${id}`); } catch { /* sandboxed frame */ }
  }, [id]);
  useEffect(() => {
    const onHash = () => {
      const named = allChapters.find((c) => c.id === window.location.hash.slice(1));
      if (!named) return;
      if (!named.core) setMode('full');
      setId(named.id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { if (sheet) setSheet(null); else if (showNotes) setShowNotes(false); return; }
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return;
      if (e.key === '?') { setSheet((s) => (s === 'help' ? null : 'help')); return; }
      if (e.key === 'g' || e.key === 'G') { setSheet((s) => (s === 'overview' ? null : 'overview')); return; }
      if (sheet) return;
      const onButton = el?.tagName === 'BUTTON' || el?.tagName === 'A';
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !onButton)) { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      else if (e.key === 'f' || e.key === 'F') toggleFull();
      else if (e.key === 'p' || e.key === 'P') setAuto((a) => !a);
      else if (e.key === 'n' || e.key === 'N') setShowNotes((v) => !v);
      else if (e.key === 'm' || e.key === 'M') toggleMode();
      else if (e.key === 'Home') goTo(0);
      else if (e.key === 'End') goTo(Number.MAX_SAFE_INTEGER);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [go, goTo, sheet, showNotes, toggleFull, toggleMode]);

  useEffect(() => {
    if (!auto) return;
    if (index >= deck.length - 1) { setAuto(false); return; }
    if (ch.kind === 'replay') { if (!replayDone) return; go(1); return; }
    const t = setTimeout(() => go(1), ch.dwell * 1000);
    return () => clearTimeout(t);
  }, [auto, index, deck.length, ch.dwell, ch.kind, replayDone, go]);

  useEffect(() => { if (ch.kind === 'replay') replay.restart(); else replay.setPlaying(false); }, [ch.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 600));
    idle(() => { void loadMath(); });
  }, []);
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  const isReplay = ch.kind === 'replay';
  const isFigure = ch.kind === 'figure';
  const right = ch.align === 'right';
  const station = Math.max(0, stations.findIndex((c) => c.id === ch.id));
  // While a figure chapter is up, keep the 3D camera parked at the station it will return to.
  const parked = useRef(station);
  if (!isFigure) parked.current = station;
  const sceneClass = isReplay ? 'exhibit-full' : `presentation-exhibit ${ch.wide ? 'presentation-exhibit-narrow' : ''} ${right ? 'exhibit-left' : 'exhibit-right'}`;
  const sectionLabel = sections.find((s) => s.id === ch.section)?.label ?? '';

  return (
    <div className={CLEAN ? 'stage stage-clean' : 'stage'} data-chapter={ch.id}>
      <div className="stage-main">
        <div className={sceneClass} aria-hidden={isFigure} data-side={isReplay ? 'full' : right ? 'left' : 'right'}
          style={{ opacity: isFigure ? 0 : 1, visibility: isFigure ? 'hidden' : 'visible', transition: 'opacity .35s', pointerEvents: isFigure ? 'none' : undefined }}>
          {webgl
            ? <Suspense fallback={<div className="h-full w-full" />}>
                <Scene station={parked.current} active={!isFigure} replay={isReplay} snap={replay.snap} selected={replay.market} time={replay.time} events={replay.run.events} duration={replay.run.duration} />
              </Suspense>
            : <div className="h-full w-full" style={{ background: 'radial-gradient(circle at 70% 40%, hsl(var(--yes)/.25), transparent 50%), radial-gradient(circle at 30% 70%, hsl(var(--no)/.25), transparent 50%), var(--plate)' }} data-testid="fallback-webgl" />}
        </div>

        <AnimatePresence mode="wait">
          {isReplay ? (
            <motion.section key="replay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-10" data-testid="section-replay">
              <h1 className="sr-only">{ch.title}</h1>
              <div className="pointer-events-auto absolute left-[15%] right-[15%]" style={{ bottom: '.9rem' }}><ReplayPanel r={replay} /></div>
              <p className="absolute left-0 right-0 text-center" style={{ top: '-.2rem', fontSize: '.76rem', color: 'var(--ink-soft)' }}>Illustrative replay with fictional markets and compressed dates. Not historical fills.</p>
            </motion.section>
          ) : ch.core ? <OriginalChapter key={ch.id} ch={ch} /> : <Suspense key={ch.id} fallback={null}><MathChapter ch={ch} /></Suspense>}
        </AnimatePresence>
      </div>

      <header className="stage-head">
        <button className="wordmark" onClick={() => goTo(0)} style={{ visibility: index === 0 ? 'hidden' : 'visible', cursor: 'pointer' }} aria-label="Back to the title">buying the opening favourite</button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
          <span className="section-name">{sectionLabel}</span>
          <span className="counter" data-testid="text-chapter-count">{String(index + 1).padStart(2, '0')} / {String(deck.length).padStart(2, '0')}</span>
        </div>
      </header>

      {showNotes && !sheet && <Notes ch={ch} onClose={() => setShowNotes(false)} />}

      <footer className="stage-foot">
        <Rail deck={deck} index={index} onGo={goTo} />
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <button className="ink-btn" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous chapter" data-testid="button-prev"><ChevronLeft size="1.05rem" /></button>
            <button className="ink-btn" onClick={() => go(1)} disabled={index === deck.length - 1} aria-label="Next chapter" data-testid="button-next"><ChevronRight size="1.05rem" /></button>
            <button className="ink-btn" data-on={auto} onClick={() => setAuto((a) => !a)} data-testid="button-autoplay">{auto ? <Pause size=".95rem" /> : <Play size=".95rem" />}<span className="hidden sm:inline">{auto ? 'Presenting' : 'Present'}</span></button>
          </div>
          <div className="flex gap-1.5">
            <div className="seg deck-switch" role="group" aria-label="Deck length" title="Full deck or the original nine chapters (M)">
              <button aria-pressed={mode === 'full'} onClick={() => mode !== 'full' && toggleMode()} data-testid="button-deck-full">Full<span className="hidden lg:inline">&nbsp;deck</span></button>
              <button aria-pressed={mode === 'core'} onClick={() => mode !== 'core' && toggleMode()} data-testid="button-deck-core">Short</button>
            </div>
            <button className="ink-btn" data-on={sheet === 'overview'} onClick={() => setSheet((s) => (s === 'overview' ? null : 'overview'))} aria-label="All chapters" title="All chapters (G)" data-testid="button-overview"><LayoutGrid size=".95rem" /><span className="hidden md:inline">Chapters</span></button>
            <button className="ink-btn only-wide" data-on={showNotes} onClick={() => setShowNotes((v) => !v)} aria-label="Presenter notes" title="Presenter notes (N)" data-testid="button-notes"><StickyNote size=".95rem" /><span className="hidden md:inline">Notes</span></button>
            {SHOW_PDF && <a className="ink-btn only-wide" href={`${BASE}source/strategy.pdf`} target="_blank" rel="noreferrer" title="The original slides" data-testid="link-pdf"><FileText size=".95rem" /><span className="hidden sm:inline">PDF</span></a>}
            <button className="ink-btn only-wide" onClick={() => setSheet((s) => (s === 'help' ? null : 'help'))} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" data-testid="button-help"><HelpCircle size=".95rem" /></button>
            <button className="ink-btn" onClick={toggleFull} aria-label={full ? 'Leave full screen' : 'Full screen'} title="Full screen (F)" data-testid="button-fullscreen">{full ? <Minimize size=".95rem" /> : <Maximize size=".95rem" />}</button>
          </div>
        </div>
      </footer>

      {sheet === 'overview' && <Overview deck={deck} index={index} onGo={goTo} onClose={() => setSheet(null)} />}
      {sheet === 'help' && <Help onClose={() => setSheet(null)} />}
    </div>
  );
}

export default App;
