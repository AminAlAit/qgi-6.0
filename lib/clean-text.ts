/**
 * cleanEmDashes — strip the em-dash (—, U+2014) from rendered copy.
 *
 * House style (founder, 2026-06-04): no "AI em-dash" in user-facing text.
 * Most of our prose is bake-generated data — trend hero definitions, the 1,200+
 * precedent event labels, card descriptions — so we clean at RENDER time rather
 * than editing the data files. That way a re-bake can never reintroduce them.
 *
 * An em-dash (with any surrounding spaces) collapses to a comma + space, which
 * reads naturally whether it separated an appositive mid-sentence ("X — a shift
 * — Y" → "X, a shift, Y") or a title from a descriptor ("Crisis — Conflict" →
 * "Crisis, Conflict"). En-dashes (–) in numeric ranges are left untouched; they
 * are correct typography, not the thing the rule is about.
 */
export function cleanEmDashes(s: string): string {
  if (!s) return s;
  return (
    s
      .replace(/\s*—\s*/g, ", ")
      // Guard the rare cases where the dash sat next to existing punctuation.
      .replace(/,\s*,/g, ",")
      .replace(/^\s*,\s*/, "")
  );
}
