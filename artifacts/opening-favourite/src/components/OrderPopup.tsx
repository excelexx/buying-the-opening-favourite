import type { marketAction } from '@/lib/timeline-actions';

/** Both animations share a keyed wrapper so their buzz phases stay in sync. */
export function OrderPopup({ action, color }: {
  action: ReturnType<typeof marketAction>;
  color: string;
}) {
  const buzzing = action?.trying || action?.rejected;
  const animation = action?.rejected ? 'timeline-popup-rejected' : action?.trying ? 'timeline-popup-attempt' : '';
  return (
    <div key={action?.animationKey ?? 'rest'} className={`timeline-popup-feedback ${animation}`}>
      {buzzing && <div className="timeline-rejection-reason" data-testid="rejection-reason">No matching sellers</div>}
      <div className="timeline-popup-card" style={{
        border: `1px solid ${buzzing ? '#d8402a' : `${color}55`}`,
      }}>{action?.text}</div>
    </div>
  );
}
