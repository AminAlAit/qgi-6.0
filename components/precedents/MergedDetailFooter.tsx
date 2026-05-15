import Link from "next/link";
import type { Route } from "next";

/**
 * Cross-family handoff footer for /precedents/[slug] (Build PR #2).
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   section: "Cross-family handoffs"
 *
 * Renders BELOW the wrapped detail content (V1 PrecedentSlugClient or
 * V2 PrecedentsV2Detail). The wrapped components retain their own internal
 * cross-references; this footer adds the BRIEF-mandated cross-family links
 * that don't fit cleanly inside either existing component.
 *
 * Handoffs implemented in this PR (#2):
 *   - Sibling lineage link (ML ↔ Stat) — "See the unadjudicated statistical
 *     signal this recipe was promoted from →" (or reverse).
 *   - Methodology ranked-patterns link — "See related ranked patterns →"
 *     pointing at /patterns?sort=loco_auc (Family 4 brief locked target;
 *     was /patterns/ranking before Family 4 killed that route).
 *
 * Deferred to PR #3:
 *   - Country names inline-linked inside the mechanism cell (mechanism cell
 *     is built in PR #3).
 *   - "{n} countries firing now →" pill (lives inside mechanism cell).
 */

export function MergedDetailFooter({
  lineage,
  slug,
}: {
  lineage: "ML" | "STAT";
  slug: string;
}) {
  // Sibling lineage cross-link. For now the sibling is the V1 or V2 route
  // (until PR #5 cutover deletes those). Once cutover lands, the sibling
  // collapses to the same /precedents/[slug] URL — the lineage
  // pivot becomes a state toggle inside this shell rather than a route hop.
  const siblingHref: Route =
    lineage === "ML"
      ? (`/precedents/${slug}` as Route)
      : (`/precedents-v2b/${slug}` as Route);
  const siblingLabel =
    lineage === "ML"
      ? "See the unadjudicated statistical signal this recipe was promoted from →"
      : "See the ML-validated version of this recipe →";
  // For STAT rows the ML sibling only exists if this recipe is in the top-4
  // LOCKed set. PR #2 renders the link unconditionally; PR #3 will gate it
  // on actual ML coverage when the mechanism cell ships its full lineage
  // routing logic.

  return (
    <section
      className="max-w-3xl mx-auto px-6 lg:px-8 py-6 mt-4 border-t"
      style={{
        borderColor: "var(--qgi-border)",
      }}
      aria-label="Cross-family handoffs"
    >
      <div
        className="text-[10px] tracking-widest uppercase mb-3"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Related across QGI
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <Link
          href={siblingHref}
          className="hover:text-[var(--qgi-accent)] transition-colors"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {siblingLabel}
        </Link>
        <Link
          href={"/patterns?sort=loco_auc" as Route}
          className="hover:text-[var(--qgi-accent)] transition-colors"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          See related ranked patterns →
        </Link>
        <Link
          href={"/methodology" as Route}
          className="hover:text-[var(--qgi-accent)] transition-colors"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          How we validated this →
        </Link>
      </div>
      <p className="text-[10px] mt-4 font-data" style={{ color: "var(--qgi-text-dim)" }}>
        Merged preview · {lineage === "ML" ? "ML-adjudicated" : "Statistical screen"}{" "}
        lineage · cutover pending sign-off
      </p>
    </section>
  );
}
