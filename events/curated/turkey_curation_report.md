# Turkey Events Curation Report

## Schema Mirrored

Mirrored from `jordan.json`. Fields: `year` (integer), `title` (string), `description` (1-3 sentences), `category` (controlled vocabulary), `verified` (boolean), `verification_source` (URL or null). All 51 events in this file have `verified: true` and a real URL in `verification_source`.

## Time Distribution (Events Per 5-Year Window)

| Window | Count |
|--------|-------|
| 1990–1994 | 4 |
| 1995–1999 | 7 |
| 2000–2004 | 5 |
| 2005–2009 | 4 |
| 2010–2014 | 8 |
| 2015–2019 | 9 |
| 2020–2025 | 14 |

**Total: 51 events.** The 2020–2025 window is larger due to cumulative events from the economic crisis sequence and the 2023 earthquake; quality was maintained throughout.

## Category Breakdown

| Category | Count |
|----------|-------|
| elections_and_voting | 9 |
| economic_crisis / economic_policy_and_reform | 7 |
| military_conflict | 4 |
| foreign_policy | 6 |
| political_repression | 3 |
| natural_disaster | 3 |
| insurgency_and_guerrilla | 3 |
| terrorism_and_extremism | 2 |
| regional_integration | 5 |
| constitutional_change | 3 |
| social_movements_and_protest | 1 |
| peacekeeping_and_peace_process | 2 |
| migration_and_refugees | 2 |
| international_alliances | 3 |
| diplomacy_and_negotiations | 1 |
| political_corruption | 2 |
| military_coup | 2 |
| religion_and_society | 1 |
| media_and_press_freedom | 1 |
| race_and_ethnic_relations | 1 |
| political_reform | 1 |

## Top 5 Sources Used

1. **Wikipedia (en.wikipedia.org)** — Used for chronology, casualty figures, and cross-verification of dates for major events including the 2001 crisis, 2016 coup, 2023 earthquake, and elections.
2. **Al Jazeera (aljazeera.com)** — Used for the 2021 central bank governor firing, 2025 İmamoğlu arrest, 2015 Ankara bombings, and Operation Peace Spring.
3. **Human Rights Watch (hrw.org)** — Used for the 2016 post-coup purges and the 2025 İmamoğlu jailing; authoritative on political repression events.
4. **NATO official site (nato.int)** — Used for the June 2022 Trilateral Memorandum signing date and text.
5. **UN official site (un.org)** and **USCIRF (uscirf.gov)** — Used for the Black Sea Grain Initiative and the Sivas massacre respectively.

## Events Considered and Rejected

1. **2003 Istanbul Susurluk trial verdicts** — No precise date available; trials dragged on inconclusively and no single verdict event was clean enough to stand alone.
2. **2007 Ergenekon indictments (alleged deep-state network)** — Considered as a counterpart to the 2016 Gülenist rupture, but the event is contested (many scholars now view the prosecutions as themselves Gülenist fabrications) and attribution is too murky for a curation requiring verified facts.
3. **Turkey-Armenia normalization protocols (October 2009)** — Protocols were signed but never ratified; the event is better categorized as a failure than a milestone, and the exact outcome is ambiguous enough to risk misleading the pipeline.
4. **2014 Soma mine disaster (301 killed, May 2014)** — A significant industrial disaster with a precise date (13 May 2014) and strong sourcing; excluded only to keep the file focused on geopolitically consequential events rather than industrial safety incidents. Could be added in a future pass.
5. **2020 Libya intervention start date** — Multiple conflicting sources cite different dates for when Turkish ground forces and drone operations began; excluded to avoid an imprecise date rather than compromising the verification standard.

## Open Questions and Gaps

- **1990–1994 PKK violence specifics**: ACLED data for Turkey pre-2000 is sparse. Specific attack dates and fatality counts for key 1990s PKK operations (e.g., Bingöl helicopter downing, 1993 cease-fire/breakdown) were not verified to the precision required and were rolled into the broader 1991 insurgency entry.
- **1997 Welfare Party ban (January 1998)**: The Constitutional Court ban of the Welfare Party is a distinct event from the February 28 postmodern coup and could be broken out as its own entry with the source at the Constitutional Court ruling date.
- **2005 currency reform (New Turkish Lira)**: Folded into the EU accession negotiations entry. A standalone economic reform entry with IMF data citation could be added.
- **Post-2023 earthquake reconstruction data**: The fiscal cost and reconstruction spending (estimated at $104 billion by the government) would pair well with World Bank/IMF data for indicator correlation purposes and could be added as a separate economic-shock event.
