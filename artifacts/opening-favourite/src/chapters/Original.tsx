import { motion } from 'framer-motion';
import { types, buyingSteps, normalRows, stressedRows, startChart, fillExample, discount, type Slide } from '@/deck';
import { Copy, Lead, Foot } from '@/components/Layout';

/** The nine chapters of the original deck. Their wording is unchanged. */

function ResultTable({ rows, head }: { rows: { p: string; v: string; r: string }[]; head: string }) {
  return (
    <table className="data-table">
      <thead><tr><th>Period</th><th className="num">{head}</th><th className="num">Return on $1,000</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <motion.tr key={r.p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.1 }}
          className={i === rows.length - 1 ? 'total' : undefined}>
          <td>{r.p}</td><td className="num strong">{r.v}</td><td className="num">{r.r}</td>
        </motion.tr>
      ))}</tbody>
    </table>
  );
}

export function OriginalChapter({ ch }: { ch: Slide }) {
  switch (ch.id) {
    case 'open': return (
      <Copy ch={ch} hero>
        <div style={{ marginTop: '1.6rem' }}>
          <div className="hero-number">$301.55</div>
          <div style={{ marginTop: '.7rem', fontSize: '1.3rem', fontWeight: 600 }}>30.16% return</div>
          <div style={{ marginTop: '.35rem', fontSize: '1.12rem' }}>Normal net paper profit across 2024–2026</div>
          <div style={{ marginTop: '.25rem', fontSize: '1.12rem', color: 'var(--ink-soft)' }}>One $1,000 starting account across 52 voting dates.</div>
        </div>
      </Copy>);
    case 'types': return (
      <Copy ch={ch}>
        <ul style={{ marginTop: '1.2rem', fontSize: '1.12rem' }}>
          {types.map((t, i) => (
            <motion.li key={t} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.07 }}
              style={{ borderTop: '1px solid var(--rule)', padding: '.48rem 0' }}>{t}</motion.li>
          ))}
        </ul>
        <Lead>Buy the YES or NO side with the higher market probability of winning.</Lead>
      </Copy>);
    case 'buying': return (
      <Copy ch={ch}>
        <Lead>Every contract uses the same cash account. Each becomes active three days before its own voting date.</Lead>
        <ol className="steps">
          {buyingSteps.map((b, i) => (
            <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.12 }}><span>{b}</span></motion.li>
          ))}
        </ol>
        <Foot>The tested rule allows more purchases until two days after voting, unless the market closes earlier. Settled cash can fund later elections.</Foot>
      </Copy>);
    case 'trigger': return (
      <Copy ch={ch}>
        <Lead>We try to buy at each usable quote when there is no live order, enough cash and room below the 100-share cap. Trades determine what fills.</Lead>
        <table className="data-table">
          <thead><tr><th>Example time</th><th>What happens</th><th className="num">Shares held</th></tr></thead>
          <tbody>{fillExample.map((r, i) => (
            <motion.tr key={r.t} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.3 }}>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '.9em', color: 'var(--yes-hex)', paddingRight: '.9rem', whiteSpace: 'nowrap' }}>{r.t}</td>
              <td>{r.what}</td><td className="num strong">{r.held}</td>
            </motion.tr>
          ))}</tbody>
        </table>
        <Foot>Normal fills take up to 2.5% of an eligible trade after a 2-second delay. An unfilled order expires after 30 seconds, freeing us to try at the next usable quote.</Foot>
      </Copy>);
    case 'results': return (
      <Copy ch={ch}>
        <Lead>Same strategy throughout. Buy the favored side immediately, keep buying within the window, then hold until settlement.</Lead>
        <ResultTable rows={normalRows} head="Normal net profit" />
        <Foot>Each annual row starts with $1,000 separately. The continuous run starts with $1,000 once and carries profits forward, so the annual rows do not add to its total.</Foot>
        <Foot>Normal fills assume a 2-second delay, up to 2.5% of an eligible trade and 0.1¢ extra cost per share, plus exchange fees. 2026 ends at the November 20 cutoff.</Foot>
      </Copy>);
    case 'start': return (
      <Copy ch={ch}>
        <Lead>Normal execution across 2024–2026. Each replay moves both the first observation and the first possible purchase to the indicated day.</Lead>
        <div className="mt-5 flex h-40 items-end gap-3 md:hidden">
          {startChart.map((c) => (
            <div key={c.label} className="flex flex-1 flex-col items-center gap-1" style={{ fontSize: '.72rem' }}>
              <span style={{ fontWeight: 600 }}>${c.v.toFixed(2)}</span>
              <div className="w-full" style={{ height: `${(c.v / 320) * 100}px`, background: 'var(--yes-hex)' }} />
              <span className="text-center">{c.label}</span>
            </div>
          ))}
        </div>
        <Lead>Normal profit was $301.55 with a three-day start and $223.69 with a voting-day start.</Lead>
      </Copy>);
    case 'stressed': return (
      <Copy ch={ch}>
        <Lead>The same strategy with slower and smaller fills, and higher costs. “Stressed” describes the execution assumptions.</Lead>
        <ResultTable rows={stressedRows} head="Stressed net profit" />
        <Foot>Stressed fills wait 5 seconds, take up to 1% of an eligible trade and add 1.1¢ per share, plus exchange fees. Normal fills use 2 seconds, 2.5% and 0.1¢.</Foot>
        <Foot>Annual rows restart at $1,000. The continuous run carries cash forward. With starts 3, 2, 1 and 0 days before voting, stressed profits were $229.94, $111.09, $211.00 and $135.38.</Foot>
      </Copy>);
    case 'appendix': return (
      <Copy ch={ch}>
        <Lead>Both variants keep the same roster, opening side, $1,000 account and settlement rule. Only the entry price rule changes.</Lead>
        <div style={{ marginTop: '1.1rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))' }}>
          <div style={{ borderTop: '2px solid var(--ink-hex)', paddingTop: '.4rem' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', lineHeight: 1.2 }}>Wait on every date</div>
            <p style={{ marginTop: '.3rem', fontSize: '.95rem', lineHeight: 1.42, color: 'var(--ink-soft)' }}>Buy only when the ask plus estimated fees and trading costs falls below the chosen side’s opening midpoint.</p>
          </div>
          <div style={{ borderTop: '2px solid var(--ink-hex)', paddingTop: '.4rem' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', lineHeight: 1.2 }}>Wait except on general-election dates</div>
            <p style={{ marginTop: '.3rem', fontSize: '.95rem', lineHeight: 1.42, color: 'var(--ink-soft)' }}>On regular federal general-election dates, buy immediately. On all other voting dates, require the same discount.</p>
          </div>
        </div>
        <table className="data-table">
          <thead><tr><th>Net paper profit</th><th className="num">Normal</th><th className="num">Stressed</th></tr></thead>
          <tbody>{discount.map((d) => <tr key={d.label}><td>{d.label}</td><td className="num strong">{d.normal}</td><td className="num">{d.stressed}</td></tr>)}</tbody>
        </table>
      </Copy>);
    default: return null;
  }
}
