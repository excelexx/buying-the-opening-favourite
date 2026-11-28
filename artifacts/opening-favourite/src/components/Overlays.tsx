import { X as Close } from 'lucide-react';
import { sections, type Slide } from '@/deck';
import { notes } from '@/notes';

/** Every chapter on one page. Click one to jump there. */
export function Overview({ deck, index, onGo, onClose }: { deck: Slide[]; index: number; onGo: (i: number) => void; onClose: () => void }) {
  return (
    <div className="sheet" role="dialog" aria-label="All chapters" data-testid="sheet-overview">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
        <h2 className="chapter-title" style={{ fontSize: '2rem' }}>All chapters</h2>
        <button className="ink-btn" onClick={onClose} aria-label="Close"><Close size="1rem" /><span>Close</span></button>
      </div>
      {sections.map((s) => {
        const items = deck.map((c, i) => ({ c, i })).filter(({ c }) => c.section === s.id);
        if (!items.length) return null;
        return (
          <section key={s.id} style={{ marginTop: '1.1rem' }}>
            <h3 style={{ fontSize: '.86rem', fontWeight: 600, marginBottom: '.5rem' }}>{s.label}</h3>
            <div className="overview-grid">
              {items.map(({ c, i }) => (
                <button key={c.id} className="overview-card" data-now={i === index} onClick={() => { onGo(i); onClose(); }} data-testid={`card-${c.id}`}>
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="t">{c.title}</span>
                  <span className="s">{c.summary}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Presenter notes for the current chapter. */
export function Notes({ ch, onClose }: { ch: Slide; onClose: () => void }) {
  const lines = notes[ch.id] ?? [];
  return (
    <aside className="notes" aria-label="Presenter notes" data-testid="panel-notes">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <h2>Presenter notes</h2>
        <button onClick={onClose} aria-label="Hide notes" style={{ opacity: 0.7, cursor: 'pointer', display: 'inline-flex' }}><Close size="1rem" /></button>
      </div>
      <ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
    </aside>
  );
}

const KEYS: [string, string][] = [
  ['→  Space  PgDn', 'Next chapter'],
  ['←  PgUp', 'Previous chapter'],
  ['Home  End', 'First or last chapter'],
  ['G', 'All chapters'],
  ['N', 'Presenter notes'],
  ['M', 'Switch between the full deck and the original nine chapters'],
  ['P', 'Present: advance on a timer'],
  ['F', 'Full screen'],
  ['?', 'This list'],
];

export function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet" role="dialog" aria-label="Keyboard shortcuts" data-testid="sheet-help" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '34rem', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginBottom: '1.2rem' }}>
          <h2 className="chapter-title" style={{ fontSize: '2rem' }}>Keyboard</h2>
          <button className="ink-btn" onClick={onClose} aria-label="Close"><Close size="1rem" /><span>Close</span></button>
        </div>
        <div className="keys">
          {KEYS.map(([k, what]) => (<div key={k} style={{ display: 'contents' }}><kbd>{k}</kbd><span>{what}</span></div>))}
        </div>
        <p className="foot-note" style={{ marginTop: '1.4rem' }}>Any chapter can be linked directly: the address ends in its name, for example #correlation.</p>
      </div>
    </div>
  );
}
