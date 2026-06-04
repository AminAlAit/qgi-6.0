/**
 * analogue-pair — resolver for the individual analogue comparison page
 * (`/analogues/[trio]`, trio = `${subjectIso2}-${analogueIso2}-${year}`).
 *
 * An analogue is: a SUBJECT country (today) matched by the Trajectory Engine to
 * a past country-year, under a primary trend. This page shows, for that trend's
 * DRIVER indicators, the two countries' trajectories over the trend's canonical
 * window — the subject's recent run-up vs the analogue's run-up to its event.
 *
 * Each indicator series is z-scored against that country's own full history, so
 * the overlay reads as SHAPE resemblance (the basis of the match), not raw-level
 * difference. Window length = the trend's canonical length (greedy_walk.chosen_window).
 *
 * Honesty: "what happened next" is dated history ABOUT THE ANALOGUE, never a
 * forecast about the subject.
 */
import { loadAnalogs, loadCardV3 } from "@/lib/te-data-contract/load";
import { getIndicatorSeries } from "@/lib/te-data-contract/indicator-panels";
import { getIndicatorLabel } from "@/lib/indicator-labels";
import { getWhatHappenedNextByIso } from "@/lib/curation/what-happened-next";
import { getRecipe } from "@/lib/te-mock/recipes";
import { familyColor } from "@/lib/te-mock/l1-families";
import { iso2For } from "@/lib/te-mock/country-flags";

const DEFAULT_WINDOW = 12;

export interface DriverOverlay {
  code: string;
  name: string;
  /** 0..100 display series (z-scored vs the country's own history, then mapped
   *  ±3σ → 0..100 — the same scale the 12-quarter analogue trajectories use).
   *  Ascending by year; length = number of years with data in the window. */
  subject: number[];
  analogue: number[];
}

export interface AnaloguePair {
  subjectIso2: string;
  subjectName: string;
  analogueIso2: string;
  analogueName: string;
  analogueYear: number;
  recipeId: string;
  trendLabel: string;
  familyColor: string;
  matchScore: number; // 0..100
  weak: boolean;
  windowYears: number;
  whatHappenedNext: string | null;
  sources?: string[];
  drivers: DriverOverlay[];
}

/** Z-score a yearly series against its own full history. Returns {} if <2 points. */
function zscoreFull(series: Record<string, number> | null): Record<string, number> {
  if (!series) return {};
  const vals = Object.values(series);
  if (vals.length < 2) return {};
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  const std = Math.sqrt(variance) || 1;
  const out: Record<string, number> = {};
  for (const [y, v] of Object.entries(series)) out[y] = (v - mean) / std;
  return out;
}

/** Map a z-score to the 0..100 display scale (±3σ clamped) — mirrors the
 *  `zTrajToDisplay` mapping used for the 12-quarter analogue trajectories. */
function zToDisplay(z: number): number {
  return Math.max(0, Math.min(100, ((z + 3) / 6) * 100));
}

/** Window of display values ending at endYear (inclusive), ascending; gaps dropped. */
function windowDisplay(
  z: Record<string, number>,
  endYear: number,
  windowYears: number
): number[] {
  const out: number[] = [];
  for (let y = endYear - windowYears + 1; y <= endYear; y++) {
    const v = z[String(y)];
    if (typeof v === "number") out.push(zToDisplay(v));
  }
  return out;
}

export function getAnaloguePair(
  subjectIso2: string,
  analogueIso2: string,
  year: number
): AnaloguePair | null {
  let entries;
  try {
    entries = loadAnalogs().entries;
  } catch {
    return null;
  }
  const si = subjectIso2.toLowerCase();
  const ai = analogueIso2.toLowerCase();
  // Tolerant match: prefer the stored ISO-2, fall back to name→ISO-2. Lets links
  // built from country names (e.g. the country-profile panel) resolve even when
  // the stored code and iso2For(name) disagree on a long-tail country.
  const subj = entries.find(
    (e) =>
      (e.iso2 ?? "").toLowerCase() === si || (iso2For(e.name) ?? "").toLowerCase() === si
  );
  if (!subj) return null;
  const a = (subj.analogs ?? []).find(
    (x) =>
      x.year === year &&
      ((x.country_iso2 ?? "").toLowerCase() === ai ||
        (iso2For(x.country) ?? "").toLowerCase() === ai)
  );
  if (!a) return null;

  const recipe = getRecipe(a.primary_recipe_id);
  let drivers: string[] = [];
  let windowYears = DEFAULT_WINDOW;
  try {
    const card = loadCardV3(a.primary_recipe_id);
    drivers = card.greedy_walk?.selected_indicators ?? [];
    const cw = card.greedy_walk?.chosen_window;
    if (typeof cw === "number" && cw > 0) windowYears = cw;
  } catch {
    /* no card → header + whn only */
  }
  const fam = familyColor(recipe?.l1_id ?? "", recipe?.l1_color ?? "#9ab0c4");

  const overlays: DriverOverlay[] = [];
  for (const code of drivers) {
    const subjZ = zscoreFull(getIndicatorSeries(si, code));
    const analZ = zscoreFull(getIndicatorSeries(ai, code));
    const subjYears = Object.keys(subjZ).map(Number);
    const analYears = Object.keys(analZ).map(Number);
    if (subjYears.length === 0 || analYears.length === 0) continue;
    const subjEnd = Math.max(...subjYears); // subject's "today" = latest year present
    const sW = windowDisplay(subjZ, subjEnd, windowYears);
    const aW = windowDisplay(analZ, year, windowYears);
    if (sW.length < 2 || aW.length < 2) continue;
    overlays.push({
      code,
      name: getIndicatorLabel(code),
      subject: sW,
      analogue: aW,
    });
  }

  const whn = getWhatHappenedNextByIso(ai, year);
  return {
    subjectIso2: si,
    subjectName: subj.name,
    analogueIso2: ai,
    analogueName: a.country,
    analogueYear: year,
    recipeId: a.primary_recipe_id,
    trendLabel: recipe?.label ?? a.primary_recipe_id,
    familyColor: fam,
    matchScore: a.match_score <= 1 ? a.match_score * 100 : a.match_score,
    weak: !!a.weak_analog,
    windowYears,
    whatHappenedNext: whn?.blurb ?? null,
    sources: whn?.sources,
    drivers: overlays,
  };
}

/** All `{trio}` params for generateStaticParams (one per surfaced analogue). */
export function allAnaloguePairKeys(): { trio: string }[] {
  let entries;
  try {
    entries = loadAnalogs().entries;
  } catch {
    return [];
  }
  const keys: { trio: string }[] = [];
  for (const e of entries) {
    const si = (e.iso2 ?? "").toLowerCase();
    if (!si) continue;
    for (const a of (e.analogs ?? []).slice(0, 3)) {
      const ai = (a.country_iso2 ?? "").toLowerCase();
      if (!ai || !a.year) continue;
      keys.push({ trio: `${si}-${ai}-${a.year}` });
    }
  }
  return keys;
}

// analogueHref lives in the standalone `analogue-href` module (client-safe);
// re-exported here for server-side callers that already import this resolver.
export { analogueHref } from "@/lib/te-mock/analogue-href";
