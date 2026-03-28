# QGI — Open Questions

> Answered questions are moved to the relevant doc. Only unresolved questions live here.
> Last updated: 2026-03-28

---

## Recipes pipeline

**Q7. How do you score confidence in a Recipe alert when it is driven by predicted indicator values?**
When Recipe matching runs against current patterns that include predicted (not yet published) values, those predictions carry uncertainty that grows with how far into the future they extend. How should this uncertainty be surfaced to the user?

Options under consideration:
- (a) Binary flag: "this alert contains predicted values" — let the user judge
- (b) Confidence decay: score = Recipe match strength × `f(how many predicted years)` — a continuous discount
- (c) Separate alert tiers: "confirmed alert" (all real data) vs "early signal alert" (contains predictions)

Needed for: alert/confidence scoring design.
