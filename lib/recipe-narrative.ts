/**
 * Recipe-slug → display-name rewriting for buyer-facing prose.
 *
 * Background: the bake script (qgi-ml/scripts/bake_ml_recipes_for_frontend.py
 * → `mechanism_narrative` field) writes prose that opens with the raw
 * `recipe_id` slug:
 *
 *   "civil_war_and_insurgency predicts active-conflict onset..."
 *
 * Buyer readers should see:
 *
 *   "Civil war and insurgency predicts active-conflict onset..."
 *
 * The slug ALSO sometimes appears mid-prose ("under D5, elections_and_voting
 * uses..."), so we replace ALL occurrences of any known slug with its
 * display name, sentence-case-aware on the first occurrence.
 *
 * Long-term: the bake script should write `display_name`-based prose
 * directly. Filed as #683 follow-up.
 */
import type { MlRecipeEntry } from "@/lib/recipes-ml";

/**
 * Build a slug → display-name map from a list of known recipes. Pass
 * the full stack so cross-references resolve.
 */
export function buildSlugMap(recipes: MlRecipeEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of recipes) {
    if (r.recipe_id && r.display_name) {
      map[r.recipe_id] = r.display_name;
    }
  }
  return map;
}

/**
 * Replace every occurrence of any known recipe slug with its display
 * name in `prose`. Word-boundary-aware so we don't munge substrings
 * inside other tokens.
 *
 * Sentence-start handling: when a slug appears at position 0 (or after
 * a sentence-ending punctuation), the replacement uses the display name
 * verbatim — which already starts with a capital ("Civil war and...").
 * When a slug appears mid-sentence, we lowercase the first letter of
 * the display name so the prose remains grammatical.
 */
export function rewriteRecipeSlugsInProse(
  prose: string,
  slugMap: Record<string, string>
): string {
  if (!prose) return prose;
  let result = prose;
  for (const [slug, displayName] of Object.entries(slugMap)) {
    // Match slug as a whole "word" — slug chars are [a-z_], so look for
    // it surrounded by non-slug-char boundaries (start of string,
    // punctuation, whitespace).
    const regex = new RegExp(`(^|[^a-z_])(${escapeRegex(slug)})(?=[^a-z_]|$)`, "g");
    result = result.replace(regex, (_match, before: string) => {
      // If this is a sentence start (BOL or after .!? + space), keep
      // display_name capitalized. Otherwise lowercase first letter.
      const isSentenceStart = before === "" || /[.!?]\s*$/.test(before);
      const replacement = isSentenceStart
        ? displayName
        : displayName.charAt(0).toLowerCase() + displayName.slice(1);
      return before + replacement;
    });
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
