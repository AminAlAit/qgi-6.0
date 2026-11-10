<!-- PR template (#442) — reflect what we learned from the 2026-04-24 QA sweep. Keep it short and check-the-box. Delete sections that don't apply. -->

## What changed

<!-- 1-3 sentences. What does this PR do, why? Reference any tickets. -->

## Test coverage

- [ ] Added a Playwright spec for the regression OR confirmed an existing one covers it
- [ ] Added a vitest unit test where the change is unit-testable
- [ ] Ran `npm test -- --run` locally, all green
- [ ] Ran `npm run typecheck` locally, no errors

## Build hygiene

- [ ] `npm run build` succeeds with `SKIP_AUTH=true SKIP_AUTH_GROUPS=pro`
- [ ] No new `as Route` casts beyond what typed routes legitimately requires (#440)
- [ ] No hardcoded copies of stats — read from `lib/site-stats.ts` (#431)
- [ ] No new `<Link href>` to a route that doesn't exist (typed routes catches this; if you needed `as Route`, comment why)

## Touched a sensitive path?

If your PR touches any of these, double-check the related ticket:

- [ ] `lib/auth*` / `middleware.ts` / `app/api/auth/` — auth (re-read #445, #425's auth-fix)
- [ ] `lib/country-risks*` / `data/country-risks.json` — schema (#440 Zod test must still pass)
- [ ] `.github/` — CI / branch protection (don't loosen the gate without a reason)
- [ ] `lib/athena.ts` / `lib/indicator-values.ts` — costs hit Vercel function timeout

## Screenshots / output

<!-- For UI changes, screenshot before + after. For API changes, paste a curl response. -->
