# V4.1 L1-color cross-cut rule

**Author:** Dr. Kwame Asante (Compound-Risk Political Economy) — Recipes V4.1 design pass, 2026-05-27.

## Rule

L1 family color (e.g. Foreign Intervention `#E64545`) is an **accent**, not a fill. In every V4.1 panel it appears in exactly three places: (1) a thin left border on the panel (`borderLeft: 3px solid ${familyColor}`), (2) chip tints — small monospace pill outlines or the section title color, (3) the panel headline. The panel surface stays `var(--qgi-surface)`; the page stays `var(--qgi-bg)`. The family color **never floods the panel background, never tints a full row, never fills a large area** — the dark navy substrate carries the page, the family color carries the identity.

## Correct examples

- **Indicator sensitivity panel:** thin red left border + red panel title "Indicator sensitivity" + red bar fills + red outline on the AUC-drop chip. Panel surface stays dark navy.
- **Compound risk panel:** thin red left border + red headline + monospace red metric chips. Panel body and the quadrant grid stay dark navy.
- **Score distribution histogram:** thin red left border + red bar fills on the histogram. Background of the chart panel stays surface-dark.

## Incorrect examples

- A pale-red wash filling the whole panel background — floods the surface, breaks the dashboard rhythm across panels.
- A red row-stripe across every other indicator row inside a panel — turns the accent into a striping pattern, dilutes the family signal.
- A red full-width title bar header (white text on solid red) — that's a banner, not an accent; reads as a warning, not as identity.
