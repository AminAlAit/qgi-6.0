# Redirect chain verification — 2026-05-15

## Verdict: PASS WITH GAPS

All redirect _mechanics_ are correct (308 fires, destination URL is right, no double-hop chains).
Two paths surface a pre-existing design gap: `/discover-patterns-a/:slug*` and `/discover-patterns-b/:slug*`
redirect correctly to `/patterns-v2a/:slug*` and `/patterns-v2b/:slug*`, but those destination routes
return 404 because `patterns-v2a` and `patterns-v2b` have no `[slug]` dynamic sub-page.
The base paths `/patterns-v2a` and `/patterns-v2b` are 200 in both environments.
All other redirects and archive routes are fully green.

---

## Local (http://localhost:3000)

### PR-ii — V2 renames

| Old path                                        | Expected new                                     | Chain observed                                         | Result               |
| ----------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ | -------------------- |
| `/discover-patterns-a`                          | `/patterns-v2a` (200)                            | 308 → /patterns-v2a → 200                              | PASS                 |
| `/discover-patterns-a/civil_war_and_insurgency` | `/patterns-v2a/...` (200)                        | 308 → /patterns-v2a/civil_war_and_insurgency → **404** | FAIL (see §Findings) |
| `/discover-patterns-b`                          | `/patterns-v2b` (200)                            | 308 → /patterns-v2b → 200                              | PASS                 |
| `/discover-patterns-b/civil_war_and_insurgency` | `/patterns-v2b/...` (200)                        | 308 → /patterns-v2b/civil_war_and_insurgency → **404** | FAIL (see §Findings) |
| `/signals-v2-a`                                 | `/signals-v2a` (200)                             | 308 → /signals-v2a → 200                               | PASS                 |
| `/signals-v2-a/india/civil_war`                 | `/signals-v2a/india/civil_war` (200)             | 308 → /signals-v2a/india/civil_war → 200               | PASS                 |
| `/signals-v2-b`                                 | `/signals-v2b` (200)                             | 308 → /signals-v2b → 200                               | PASS                 |
| `/signals-v2-b/india/civil_war`                 | `/signals-v2b/india/civil_war` (200)             | 308 → /signals-v2b/india/civil_war → 200               | PASS                 |
| `/precedents-v2-a`                              | `/precedents-v2a` (200)                          | 308 → /precedents-v2a → 200                            | PASS                 |
| `/precedents-v2-a/civil_war_and_insurgency`     | `/precedents-v2a/civil_war_and_insurgency` (200) | 308 → /precedents-v2a/civil_war_and_insurgency → 200   | PASS                 |
| `/precedents-v2-b`                              | `/precedents-v2b` (200)                          | 308 → /precedents-v2b → 200                            | PASS                 |
| `/precedents-v2-b/civil_war_and_insurgency`     | `/precedents-v2b/civil_war_and_insurgency` (200) | 308 → /precedents-v2b/civil_war_and_insurgency → 200   | PASS                 |

### PR-iii — V3 canonical renames (`-merged` → canonical)

| Old path                                          | Expected new                                     | Chain observed                                       | Result |
| ------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- | ------ |
| `/precedents-merged`                              | `/precedents` (200)                              | 308 → /precedents → 200                              | PASS   |
| `/precedents-merged/civil_war_and_insurgency`     | `/precedents/civil_war_and_insurgency` (200)     | 308 → /precedents/civil_war_and_insurgency → 200     | PASS   |
| `/countries-merged`                               | `/countries` (200)                               | 308 → /countries → 200                               | PASS   |
| `/countries-merged/india`                         | `/countries/india` (200)                         | 308 → /countries/india → 200                         | PASS   |
| `/signals-merged`                                 | `/signals` (200)                                 | 308 → /signals → 200                                 | PASS   |
| `/signals-merged/india`                           | `/signals/india` (200)                           | 308 → /signals/india → 200                           | PASS   |
| `/signals-merged/india/civil_war_and_insurgency`  | `/signals/india/civil_war_and_insurgency` (200)  | 308 → /signals/india/civil_war_and_insurgency → 200  | PASS   |
| `/patterns-merged`                                | `/patterns` (200)                                | 308 → /patterns → 200                                | PASS   |
| `/patterns-merged/paraguay-south_korea-1963-1962` | `/patterns/paraguay-south_korea-1963-1962` (200) | 308 → /patterns/paraguay-south_korea-1963-1962 → 200 | PASS   |

### PR-iii — V1 conflict sub-routes

| Old path            | Expected new                 | Chain observed                   | Result |
| ------------------- | ---------------------------- | -------------------------------- | ------ |
| `/patterns/ranking` | `/patterns-v1/ranking` (200) | 308 → /patterns-v1/ranking → 200 | PASS   |
| `/signals/country`  | `/signals-v1/country` (200)  | 308 → /signals-v1/country → 200  | PASS   |

### V1 archive routes (must be 200, no redirect)

| Path                   | Expected   | Got               | Result |
| ---------------------- | ---------- | ----------------- | ------ |
| `/precedents-v1`       | 200 direct | 200 (no redirect) | PASS   |
| `/countries-v1`        | 200 direct | 200 (no redirect) | PASS   |
| `/signals-v1`          | 200 direct | 200 (no redirect) | PASS   |
| `/patterns-v1`         | 200 direct | 200 (no redirect) | PASS   |
| `/patterns-v1/ranking` | 200 direct | 200 (no redirect) | PASS   |
| `/signals-v1/country`  | 200 direct | 200 (no redirect) | PASS   |

### V2 archive routes (must be 200, no redirect)

| Path                      | Expected   | Got               | Result |
| ------------------------- | ---------- | ----------------- | ------ |
| `/precedents-v2a`         | 200 direct | 200 (no redirect) | PASS   |
| `/precedents-v2b`         | 200 direct | 200 (no redirect) | PASS   |
| `/signals-v2a`            | 200 direct | 200 (no redirect) | PASS   |
| `/signals-v2b`            | 200 direct | 200 (no redirect) | PASS   |
| `/patterns-v2a`           | 200 direct | 200 (no redirect) | PASS   |
| `/patterns-v2b`           | 200 direct | 200 (no redirect) | PASS   |
| `/countries-v2-table`     | 200 direct | 200 (no redirect) | PASS   |
| `/countries-v2-narrative` | 200 direct | 200 (no redirect) | PASS   |

---

## Production (https://qgintelligence.com)

### PR-ii — V2 renames

| Old path                                        | Expected new                                        | Chain observed                                          | Result               |
| ----------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- | -------------------- |
| `/discover-patterns-a`                          | `/patterns-v2a` (200)                               | 308 → /patterns-v2a → 200                               | PASS                 |
| `/discover-patterns-a/civil_war_and_insurgency` | `/patterns-v2a/...` (200)                           | 308 → /patterns-v2a/civil_war_and_insurgency → **404**  | FAIL (see §Findings) |
| `/discover-patterns-b`                          | `/patterns-v2b` (200)                               | 308 → /patterns-v2b → 200                               | PASS                 |
| `/discover-patterns-b/civil_war_and_insurgency` | `/patterns-v2b/...` (200)                           | 308 → /patterns-v2b/civil_war_and_insurgency → **404**  | FAIL (see §Findings) |
| `/signals-v2-a`                                 | `/signals-v2a` (200)                                | 308 → /signals-v2a → 200                                | PASS                 |
| `/signals-v2-a/india/civil_war_and_insurgency`  | `/signals-v2a/india/civil_war_and_insurgency` (200) | 308 → /signals-v2a/india/civil_war_and_insurgency → 200 | PASS                 |
| `/signals-v2-b`                                 | `/signals-v2b` (200)                                | 308 → /signals-v2b → 200                                | PASS                 |
| `/signals-v2-b/india/civil_war_and_insurgency`  | `/signals-v2b/india/civil_war_and_insurgency` (200) | 308 → /signals-v2b/india/civil_war_and_insurgency → 200 | PASS                 |
| `/precedents-v2-a`                              | `/precedents-v2a` (200)                             | 308 → /precedents-v2a → 200                             | PASS                 |
| `/precedents-v2-a/civil_war_and_insurgency`     | `/precedents-v2a/civil_war_and_insurgency` (200)    | 308 → /precedents-v2a/civil_war_and_insurgency → 200    | PASS                 |
| `/precedents-v2-b`                              | `/precedents-v2b` (200)                             | 308 → /precedents-v2b → 200                             | PASS                 |
| `/precedents-v2-b/civil_war_and_insurgency`     | `/precedents-v2b/civil_war_and_insurgency` (200)    | 308 → /precedents-v2b/civil_war_and_insurgency → 200    | PASS                 |

### PR-iii — V3 canonical renames

| Old path                                          | Expected new                                     | Chain observed                                       | Result |
| ------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- | ------ |
| `/precedents-merged`                              | `/precedents` (200)                              | 308 → /precedents → 200                              | PASS   |
| `/precedents-merged/civil_war_and_insurgency`     | `/precedents/civil_war_and_insurgency` (200)     | 308 → /precedents/civil_war_and_insurgency → 200     | PASS   |
| `/countries-merged`                               | `/countries` (200)                               | 308 → /countries → 200                               | PASS   |
| `/countries-merged/india`                         | `/countries/india` (200)                         | 308 → /countries/india → 200                         | PASS   |
| `/signals-merged`                                 | `/signals` (200)                                 | 308 → /signals → 200                                 | PASS   |
| `/signals-merged/india`                           | `/signals/india` (200)                           | 308 → /signals/india → 200                           | PASS   |
| `/signals-merged/india/civil_war_and_insurgency`  | `/signals/india/civil_war_and_insurgency` (200)  | 308 → /signals/india/civil_war_and_insurgency → 200  | PASS   |
| `/patterns-merged`                                | `/patterns` (200)                                | 308 → /patterns → 200                                | PASS   |
| `/patterns-merged/paraguay-south_korea-1963-1962` | `/patterns/paraguay-south_korea-1963-1962` (200) | 308 → /patterns/paraguay-south_korea-1963-1962 → 200 | PASS   |

### PR-iii — V1 conflict sub-routes

| Old path            | Expected new                 | Chain observed                   | Result |
| ------------------- | ---------------------------- | -------------------------------- | ------ |
| `/patterns/ranking` | `/patterns-v1/ranking` (200) | 308 → /patterns-v1/ranking → 200 | PASS   |
| `/signals/country`  | `/signals-v1/country` (200)  | 308 → /signals-v1/country → 200  | PASS   |

### V1 archive routes

| Path                   | Expected   | Got               | Result |
| ---------------------- | ---------- | ----------------- | ------ |
| `/precedents-v1`       | 200 direct | 200 (no redirect) | PASS   |
| `/countries-v1`        | 200 direct | 200 (no redirect) | PASS   |
| `/signals-v1`          | 200 direct | 200 (no redirect) | PASS   |
| `/patterns-v1`         | 200 direct | 200 (no redirect) | PASS   |
| `/patterns-v1/ranking` | 200 direct | 200 (no redirect) | PASS   |
| `/signals-v1/country`  | 200 direct | 200 (no redirect) | PASS   |

### V2 archive routes

| Path                      | Expected   | Got               | Result |
| ------------------------- | ---------- | ----------------- | ------ |
| `/precedents-v2a`         | 200 direct | 200 (no redirect) | PASS   |
| `/precedents-v2b`         | 200 direct | 200 (no redirect) | PASS   |
| `/signals-v2a`            | 200 direct | 200 (no redirect) | PASS   |
| `/signals-v2b`            | 200 direct | 200 (no redirect) | PASS   |
| `/patterns-v2a`           | 200 direct | 200 (no redirect) | PASS   |
| `/patterns-v2b`           | 200 direct | 200 (no redirect) | PASS   |
| `/countries-v2-table`     | 200 direct | 200 (no redirect) | PASS   |
| `/countries-v2-narrative` | 200 direct | 200 (no redirect) | PASS   |

---

## Findings

### FAIL: `/discover-patterns-a/:slug*` and `/discover-patterns-b/:slug*` → 404 at destination

**Affected paths (local + production):**

- `GET /discover-patterns-a/civil_war_and_insurgency` → 308 → `/patterns-v2a/civil_war_and_insurgency` → **404**
- `GET /discover-patterns-b/civil_war_and_insurgency` → 308 → `/patterns-v2b/civil_war_and_insurgency` → **404**
- Any sub-route under `/discover-patterns-a/` or `/discover-patterns-b/` will 404 at the destination

**Root cause:** `patterns-v2a` and `patterns-v2b` are list-only pages — their app directories
(`app/(app)/patterns-v2a/page.tsx` and `app/(app)/patterns-v2b/page.tsx`) have no `[slug]` dynamic
sub-route. The redirect in `next.config.ts` registers `:slug*` but the destination route does not exist.

**Comparison:** `signals-v2a` and `signals-v2b` do have `[country]/[slug]` sub-routes and work correctly.
`precedents-v2a` and `precedents-v2b` have `[slug]` sub-routes and work correctly.

**Classification:** Pre-existing design gap in `patterns-v2a/b` (no detail pages), not a redirect
misconfiguration. The 308 itself is correct and consistent with the other families. The gap is that
patterns V2 never implemented a detail/slug view.

**Severity:** Low — these paths were only reachable before this PR as `/discover-patterns-a/:slug*`,
which were equally broken (the old pages also had no slug routes). No regression introduced by PR-ii.

**Recommended action:** Either (a) remove the `:slug*` redirect entries for patterns-v2a/b from
`next.config.ts` since they point to non-existent pages (cleaner), or (b) create `[slug]` pages under
`patterns-v2a/b` if that detail view is planned. Track as a follow-up ticket.

### NOTE: No double-hop redirect chains observed

All redirects resolve in a single 308 hop before reaching the final destination. No chains of
308 → 308 → 200 were observed in either environment.

### NOTE: Consistent local/production behavior

Every path behaved identically on local (`http://localhost:3000`) and production
(`https://qgintelligence.com`). Vercel is applying the Next.js redirects at edge as expected.
