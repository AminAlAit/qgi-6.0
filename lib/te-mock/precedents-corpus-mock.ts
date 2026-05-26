/**
 * precedents-corpus-mock — curated-event corpus actions feeding
 * PrecedentsTimelinePanel.
 *
 * — Daniyar Bekmurat, Comparative Historical Pattern Matching
 */
import type { PrecedentEvent } from "@/components/precedents-v4-1/PrecedentsTimelinePanel";

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
    reason: "Sustained Houthi-government conflict ≥1000 BD/yr",
  },
  {
    year: 2020,
    country: "Ethiopia",
    country_iso: "ETH",
    flag_emoji: "🇪🇹",
    action: "added",
    reason: "Tigray conflict crosses UCDP civil-war threshold",
  },
  {
    year: 2022,
    country: "Myanmar",
    country_iso: "MMR",
    flag_emoji: "🇲🇲",
    action: "added",
    reason: "Post-coup PDF insurgency reaches civil-war intensity",
  },
  {
    year: 2023,
    country: "Sudan",
    country_iso: "SDN",
    flag_emoji: "🇸🇩",
    action: "added",
    reason: "RSF-SAF war exceeds 1000 BD/yr",
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

const CORPUS_EVENTS: Record<string, PrecedentEvent[]> = {
  foreign_intervention: foreignInterventionEvents,
  civil_war_and_insurgency: civilWarEvents,
  constitutional_change: constitutionalChangeEvents,
};

const TOTAL_EVENTS_IN_CORPUS: Record<string, number> = {
  foreign_intervention: 412,
  civil_war_and_insurgency: 511,
  constitutional_change: 402,
};

export function getCorpusEvents(recipeId: string): PrecedentEvent[] {
  return CORPUS_EVENTS[recipeId] ?? [];
}

export function getTotalEventsInCorpus(recipeId: string): number {
  return TOTAL_EVENTS_IN_CORPUS[recipeId] ?? 0;
}
