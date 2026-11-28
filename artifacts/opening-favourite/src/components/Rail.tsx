import { sections, type Slide } from '@/deck';

/** Progress rail: one tick per chapter, grouped and labelled by section. */
export function Rail({ deck, index, onGo }: { deck: Slide[]; index: number; onGo: (i: number) => void }) {
  const current = deck[index]?.section;
  return (
    <nav className="rail" aria-label="Chapters">
      {sections.map((s) => {
        const items = deck.map((c, i) => ({ c, i })).filter(({ c }) => c.section === s.id);
        if (!items.length) return null;
        return (
          <div key={s.id} className="rail-group" data-active={current === s.id} style={{ flex: items.length }}>
            <div className="rail-label">{s.label}</div>
            <div className="rail-ticks">
              {items.map(({ c, i }) => (
                <button key={c.id} className="rail-tick" data-state={i === index ? 'now' : i < index ? 'done' : 'todo'}
                  onClick={() => onGo(i)} aria-label={`${i + 1}. ${c.title}`} aria-current={i === index ? 'step' : undefined}
                  data-testid={`button-chapter-${c.id}`}>
                  <span className="rail-tip">{i + 1}. {c.title}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
