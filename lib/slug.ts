/**
 * Country-name → filesystem-safe slug (TS mirror of the Python
 * `qgi-ml/shared/slug.py::country_slug`).
 *
 * Used by:
 *   - `app/(app)/countries/[id]/page.tsx` — resolve `/countries/syria` → `/countries/217`
 *   - `app/(app)/countries/[id]/page.tsx` — load curated events + salience
 *
 * Kept in sync with the Python version (#422 Bug 6). A shared JSON test
 * fixture for cross-language parity is a future improvement.
 */

/**
 * Base slug — apostrophes, periods, commas, hyphens, whitespace all
 * collapse to underscores. `&` → `and`. Lowercase.
 */
export function countrySlug(name: string | null | undefined): string | null {
  if (!name) return null;
  // #422 Bug 4: apostrophes + periods are token separators, not delete-chars.
  const withSeparators = name
    .toLowerCase()
    .replace(/'/g, " ")
    .replace(/,/g, "")
    .replace(/\./g, " ")
    .replace(/&/g, "and");
  const out = withSeparators.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return out.length ? out : null;
}

/**
 * Slug variant that strips leading "the " and collapses "of the" → "of".
 * Used when matching to curated-events filenames (e.g., "The Bahamas"
 * → curated/bahamas.json, "Democratic Republic of the Congo" →
 * curated/democratic_republic_of_congo.json).
 */
export function curatedEventsSlug(name: string | null | undefined): string | null {
  if (!name) return null;
  const s = name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\bof the\b/g, "of")
    .replace(/[-\s]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return s.length ? s : null;
}
