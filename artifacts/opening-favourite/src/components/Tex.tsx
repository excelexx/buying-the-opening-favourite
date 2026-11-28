import { memo, useMemo } from 'react';
import katex from 'katex';

/** Typeset LaTeX with KaTeX. `block` gives a left-aligned display equation. */
export const Tex = memo(function Tex({ children, block = false, small = false }: {
  children: string; block?: boolean; small?: boolean;
}) {
  const html = useMemo(
    () => katex.renderToString(children, { displayMode: block, throwOnError: false, strict: 'ignore' }),
    [children, block],
  );
  return block
    ? <div className={small ? 'eq eq-sm' : 'eq'} dangerouslySetInnerHTML={{ __html: html }} />
    : <span dangerouslySetInnerHTML={{ __html: html }} />;
});
