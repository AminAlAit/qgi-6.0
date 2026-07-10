# Handoff → Events (QGI /qgi-enrich-events) session: economic_recession event-set top-up

**From:** the ML / R&D session. **Date:** 2026-07-10. **⚠️ Reply before you launch** — reconcile first (as with the banking batch).

## Why
I'm about to enrich the **economic_recession** recipe, and Step 0 (event-set audit) flagged a representativeness gap — the banking lesson (don't spend indicator effort on a skewed event set). Current set: **216 events / 102 countries / 1950–2021** (decent size + spread), BUT it's **missing canonical recessions of major economies:**

- **United States — ABSENT entirely** (no 1973–75, 1980–82, 1990–91, 2001, 2008–09, 2020).
- **France — ABSENT. Italy — ABSENT.**
- Patchy majors: **Japan** has 1971/73/79 but missing the **1990s "lost decade"** + 2008; **Indonesia** missing the **1997–98 Asian crisis**; **South Korea** only 1998 (missing 2008); Germany missing pre-2008 recessions.

A recession recipe with no US/France/Italy and patchy 2008/1997 coverage is training/scoring on a non-representative set — the exact trap that inflated banking's number.

## What I need in your reply (before launching)
1. **Reconcile:** is the US/France/Italy absence a genuine curation gap, or a country-id/category mismatch on my side (I read `data/shape_inputs_v2/economic_recession/positives.csv`)? Confirm the current merged state.
2. **Confirmable scope:** can a targeted Mode-A batch add the missing **major-economy recessions** — priority list below?

## Target list (priority order)
- **US:** 1973–75, 1980, 1981–82, 1990–91, 2001, 2008–09, 2020 (NBER-dated onset years).
- **France, Italy:** their post-1970 recessions (1974–75, 1980s, 1992–93, 2008–09, 2011–13, 2020).
- **Fill the majors:** Japan 1993 & 1998 & 2008; Indonesia/Korea/Thailand **1997–98**; Germany 1993 & 2008; UK 1980/1990/2008.
- Onset-year (peak→trough START), your usual born-double-verified bar, `country_id` lowercase snake_case, one event = `(country_id, event_year)`.

## Then
Fire the batch (US/France/Italy-first), and **tell me when it's merged** (before→after counts + which recessions landed) — that's my trigger to rebuild `positives.csv` and start the recession enrichment. Until then I'm holding recession and running two other trends (mass_protest, terrorist_attack) whose event sets already passed Step 0.

Note vs banking: this is a *targeted representativeness top-up*, not the "grow-to-a-magic-number" retired idea — it's to make the recession set trustworthy before I test indicators on it.
