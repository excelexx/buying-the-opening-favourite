import { useRef } from 'react';
import { storyDate } from '@/lib/story';

type Replay = {
  run: { duration: number };
  time: number;
  playing: boolean;
  setTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
};

export function ReplayPanel({ r }: { r: Replay }) {
  const resume = useRef(false);
  return (
    <input className="scrub timeline-slider" aria-label="Timeline"
      aria-valuetext={storyDate(r.time)} type="range" min={0} max={r.run.duration}
      step={0.1} value={r.time} data-testid="input-scrub"
      onPointerDown={() => { resume.current = r.playing || r.time >= r.run.duration; r.setPlaying(false); }}
      onPointerUp={() => r.setPlaying(resume.current)}
      onPointerCancel={() => r.setPlaying(resume.current)}
      onChange={e => r.setTime(Number(e.target.value))} />
  );
}
