import { Pause, Play, RotateCcw } from 'lucide-react';
import type { Scenario, SimulationEvent, SimulationSnapshot } from '@/lib/simulation';
import { milestones, storyDate } from '@/lib/story';

type R = {
  scenario: Scenario; setScenario: (s: Scenario) => void;
  run: { duration: number; events: SimulationEvent[]; snapshots: SimulationSnapshot[] };
  time: number; setTime: (t: number) => void; playing: boolean; setPlaying: (p: boolean) => void;
  speed: number; setSpeed: (s: number) => void; snap: SimulationSnapshot | null; restart: () => void;
  market: string; setMarket: (m: string) => void;
};

/** A compact playback strip; order explanations belong on the market lanes. */
export function ReplayPanel({ r }: { r: R }) {
  return (
    <div className="mx-auto w-full max-w-4xl rounded-sm border border-foreground/15 bg-background/90 px-3 py-2 backdrop-blur-sm sm:px-5" data-testid="panel-replay">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-auto font-serif text-xl" data-testid="text-story-date">{storyDate(r.time)}</span>
        {(['normal', 'stressed'] as Scenario[]).map(sc => (
          <button key={sc} className="ink-btn" data-on={r.scenario === sc} onClick={() => r.setScenario(sc)} data-testid={`button-scenario-${sc}`}>{sc}</button>
        ))}
        <button className="ink-btn" aria-label={r.playing ? 'Pause replay' : 'Play replay'} onClick={() => r.time >= r.run.duration ? r.restart() : r.setPlaying(!r.playing)} data-testid="button-replay-play">
          {r.playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="ink-btn" aria-label="Restart replay" onClick={r.restart} data-testid="button-replay-restart"><RotateCcw size={14} /></button>
        {[0.5, 1, 2, 4].map(speed => (
          <button key={speed} className="ink-btn" data-on={r.speed === speed} onClick={() => r.setSpeed(speed)} data-testid={`button-speed-${speed}`}>{speed}x</button>
        ))}
      </div>
      <input className="scrub mt-2" aria-label="Replay time" type="range" min={0} max={r.run.duration} step={0.1} value={r.time}
        onChange={e => { r.setPlaying(false); r.setTime(Number(e.target.value)); }} data-testid="input-scrub" />
      <div className="mt-1 grid grid-cols-10 gap-0.5">
        {milestones.map((m, i) => (
          <button key={m.label} onClick={() => { r.setPlaying(false); r.setTime(i === milestones.length - 1 ? r.run.duration : m.time); }}
            className="py-0.5 font-mono text-[8px] uppercase opacity-60 hover:opacity-100 sm:text-[9px]"
            data-testid={`button-date-${m.label.replace(/\s/g, '')}`}>{m.label}</button>
        ))}
      </div>
    </div>
  );
}
