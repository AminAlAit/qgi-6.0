/**
 * precedents-corpus-mock — curated-event corpus actions feeding
 * PrecedentsTimelinePanel.
 *
 * V4.1 wire-up (2026-05-29):
 *   - TE sample-10 recipes source from card.precedents_corpus.
 *   - card.precedents_corpus is optional — if absent, returns [] so the UI
 *     renders the "corpus data not yet computed for this vintage" gate.
 *   - The corpus events in sample-10 have null labels and null brief_urls;
 *     the PrecedentEvent shape uses country_name as the display value.
 *   - foreign_intervention, civil_war_and_insurgency, constitutional_change
 *     keep their hand-authored data (cascade-era; no real card).
 *
 * PrecedentEvent.action note: card corpus events don't carry an "action" field.
 * We emit all as "added" since the pipeline corpus is a positive-only set.
 * Corpus curators may later introduce "vacated" rows via the editorial overlay.
 */
import type { PrecedentEvent } from "@/components/precedents-v4-1/PrecedentsTimelinePanel";
import { loadAllCards } from "@/lib/te-data-contract/load";
import { NAME_TO_ISO2, flagFromIso2 } from "@/lib/te-mock/country-iso2";

// ─── Hand-authored corpus events for cascade-era / demo recipes ───────────────

const foreignInterventionEvents: PrecedentEvent[] = [
  {
    year: 2014,
    country: "Ukraine",
    country_iso: "UKR",
    flag_emoji: "🇺🇦",
    action: "added",
    reason: "Russian annexation of Crimea + Donbas incursion",
  },
  {
    year: 2015,
    country: "Yemen",
    country_iso: "YEM",
    flag_emoji: "🇾🇪",
    action: "added",
    reason: "Saudi-led coalition air campaign",
  },
  {
    year: 2019,
    country: "Syria",
    country_iso: "SYR",
    flag_emoji: "🇸🇾",
    action: "added",
    reason: "Turkish Operation Peace Spring (NE Syria)",
  },
  {
    year: 2020,
    country: "Libya",
    country_iso: "LBY",
    flag_emoji: "🇱🇾",
    action: "added",
    reason: "Turkey-GNA deployment + UAE/Wagner counter",
  },
  {
    year: 2021,
    country: "Central African Republic",
    country_iso: "CAF",
    flag_emoji: "🇨🇫",
    action: "added",
    reason: "Wagner Group sustained ground operations",
  },
  {
    year: 2022,
    country: "Ukraine",
    country_iso: "UKR",
    flag_emoji: "🇺🇦",
    action: "added",
    reason: "Full-scale Russian invasion (24 Feb)",
  },
  {
    year: 2023,
    country: "Sudan",
    country_iso: "SDN",
    flag_emoji: "🇸🇩",
    action: "vacated",
    reason: "Re-coded intra-state RSF/SAF; not foreign per recipe def.",
  },
  {
    year: 2024,
    country: "Niger",
    country_iso: "NER",
    flag_emoji: "🇳🇪",
    action: "added",
    reason: "Post-coup Wagner/Africa Corps deployment",
  },
  {
    year: 2024,
    country: "Lebanon",
    country_iso: "LBN",
    flag_emoji: "🇱🇧",
    action: "added",
    reason: "Israeli ground operations in southern Lebanon",
  },
  {
    year: 2025,
    country: "Mali",
    country_iso: "MLI",
    flag_emoji: "🇲🇱",
    action: "added",
    reason: "Africa Corps extension following Wagner restructure",
  },
  {
    year: 2025,
    country: "Burkina Faso",
    country_iso: "BFA",
    flag_emoji: "🇧🇫",
    action: "vacated",
    reason: "Insufficient sourcing on direct foreign deployment",
  },
];

const civilWarEvents: PrecedentEvent[] = [
  {
    year: 2018,
    country: "Yemen",
    country_iso: "YEM",
    flag_emoji: "🇾🇪",
    action: "added",
    reason: "Sustained Houthi-government conflict",
  },
  {
    year: 2020,
    country: "Ethiopia",
    country_iso: "ETH",
    flag_emoji: "🇪🇹",
    action: "added",
    reason: "Tigray conflict crosses civil-war threshold",
  },
  {
    year: 2022,
    country: "Myanmar",
    country_iso: "MMR",
    flag_emoji: "🇲🇲",
    action: "added",
    reason: "Post-coup insurgency reaches civil-war intensity",
  },
  {
    year: 2023,
    country: "Sudan",
    country_iso: "SDN",
    flag_emoji: "🇸🇩",
    action: "added",
    reason: "RSF-SAF war exceeds threshold",
  },
  {
    year: 2024,
    country: "Mozambique",
    country_iso: "MOZ",
    flag_emoji: "🇲🇿",
    action: "vacated",
    reason: "Below sustained-intensity threshold; reclassified insurgency",
  },
];

const constitutionalChangeEvents: PrecedentEvent[] = [
  {
    year: 2021,
    country: "Chile",
    country_iso: "CHL",
    flag_emoji: "🇨🇱",
    action: "added",
    reason: "Constitutional convention initiated",
  },
  {
    year: 2022,
    country: "Tunisia",
    country_iso: "TUN",
    flag_emoji: "🇹🇳",
    action: "added",
    reason: "Saied-led constitution replaces 2014 charter",
  },
  {
    year: 2023,
    country: "Mali",
    country_iso: "MLI",
    flag_emoji: "🇲🇱",
    action: "added",
    reason: "Junta-promulgated new constitution (June)",
  },
  {
    year: 2024,
    country: "Kenya",
    country_iso: "KEN",
    flag_emoji: "🇰🇪",
    action: "vacated",
    reason: "Finance Bill protest fallout; no formal amendment passed",
  },
  {
    year: 2025,
    country: "Bolivia",
    country_iso: "BOL",
    flag_emoji: "🇧🇴",
    action: "added",
    reason: "Article 168 reform on presidential re-election",
  },
];

const HAND_AUTHORED_CORPUS: Record<string, PrecedentEvent[]> = {
  foreign_intervention: foreignInterventionEvents,
  civil_war_and_insurgency: civilWarEvents,
  constitutional_change: constitutionalChangeEvents,
};

const HAND_AUTHORED_TOTALS: Record<string, number> = {
  foreign_intervention: 412,
  civil_war_and_insurgency: 511,
  constitutional_change: 402,
};

// ─── TE card-derived corpus events ────────────────────────────────────────────

const _corpusCache = new Map<string, PrecedentEvent[]>();

/**
 * Build PrecedentEvent[] from card.precedents_corpus.
 * Returns [] if the field is absent or if data loading fails.
 */
function buildFromCard(recipeId: string): PrecedentEvent[] {
  try {
    const allCards = loadAllCards();
    const card = allCards[recipeId];
    if (!card || !card.precedents_corpus) return [];

    return card.precedents_corpus.events.map((e) => {
      // Resolve ISO2 from country_name for flag derivation
      const nameLower = e.country_name.toLowerCase();
      const iso2 = NAME_TO_ISO2.get(nameLower);
      const flag = iso2 ? flagFromIso2(iso2) : null;

      return {
        year: e.year,
        country: e.country_name,
        // country_iso from card is null in sample-10 — leave as the 3-letter name
        country_iso: e.country_iso ?? e.country_name.slice(0, 3).toUpperCase(),
        flag_emoji: flag ?? "",
        action: "added" as const,
        reason: e.label ?? "In training set",
      };
    });
  } catch {
    return [];
  }
}

/**
 * Return corpus events for a recipe.
 *
 * Lookup order:
 *   1. Hand-authored (foreign_intervention, civil_war_and_insurgency, constitutional_change)
 *   2. Real card.precedents_corpus data (TE sample-10)
 *   3. [] — component renders "corpus data not yet computed" gate
 */
export function getCorpusEvents(recipeId: string): PrecedentEvent[] {
  if (HAND_AUTHORED_CORPUS[recipeId]) return HAND_AUTHORED_CORPUS[recipeId];

  if (_corpusCache.has(recipeId)) return _corpusCache.get(recipeId)!;

  const events = buildFromCard(recipeId);
  _corpusCache.set(recipeId, events);
  return events;
}

/**
 * Total events in corpus for a recipe (denominator for the timeline header).
 * For TE recipes, use card.precedents_corpus.total_events_in_corpus.
 */
export function getTotalEventsInCorpus(recipeId: string): number {
  if (HAND_AUTHORED_TOTALS[recipeId]) return HAND_AUTHORED_TOTALS[recipeId];

  try {
    const allCards = loadAllCards();
    const card = allCards[recipeId];
    return card?.precedents_corpus?.total_events_in_corpus ?? 0;
  } catch {
    return 0;
  }
}
