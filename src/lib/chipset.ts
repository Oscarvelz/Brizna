import type { CSSProperties } from "react";

/**
 * 1.4.66 (Oscar): compact suggestion chips that fill the dialog width evenly.
 * Picks how many chips share a row from the longest label (so every label stays on one line),
 * then balances the rows (6 → 3+3, 5 → 3+2, 4 long → 2+2). CSS: .bz-chipset / .bz-chip in styles.css.
 */
export function chipsetStyle(labels: readonly string[], width = 320): CSSProperties {
  const n = Math.max(1, labels.length);
  const longest = Math.max(1, ...labels.map((l) => l.length));
  const chip = longest * 6.7 + 22; // ~11.5px semibold glyphs + padding
  let k = Math.min(n, 4);
  while (k > 1 && k * chip + (k - 1) * 6 > width) k -= 1;
  const rows = Math.ceil(n / k);
  k = Math.ceil(n / rows);
  return { ["--bz-k" as string]: k } as CSSProperties;
}
