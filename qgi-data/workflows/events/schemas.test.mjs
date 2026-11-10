/**
 * node --test unit tests for schemas.mjs + _lib.mjs pure functions.
 * Run: node --test qgi-data/workflows/events/
 *
 * Consensus vectors are shared with tests/test_validate_verification.py via
 * tests/consensus_vectors.json — the two consensus implementations (JS canonical,
 * Python port) are locked together by the same fixtures.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CATEGORIES_71, ACTIVE_TRENDS, DEACTIVATED_TRENDS, HAZARD_OVERLAP, SHARDS, VERDICTS,
  RUNNABLE_GATE, MAX_VERIFY_DEPTH, normTitle, recomputeConsensus
} from "./schemas.mjs";
import {
  buildVerificationEntry, cleanCuratedEvent, dedupKey, depthWhy, fillTemplate,
  isDoubleVerified, ledgerDepthReached, ledgerSettled, migrateEntry, rankTrends, pickTrend,
  trendTier, registrableDomain, sourceIndependence
} from "./_lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VECTORS = JSON.parse(fs.readFileSync(
  path.resolve(HERE, "..", "..", "tests", "consensus_vectors.json"), "utf8"));

test("CATEGORIES_71 has exactly 71 unique codes", () => {
  assert.equal(CATEGORIES_71.length, 71);
  assert.equal(new Set(CATEGORIES_71).size, 71);
  assert.equal(SHARDS.length, 8);
});

test("CATEGORIES_71 is set-equal to the live taxonomy's layer-3 codes", () => {
  // schemas.mjs hand-mirrors events/taxonomy_hierarchy.json — a rename/addition
  // there must fail here, not surface later as agent category_confab drops
  const taxonomy = JSON.parse(fs.readFileSync(
    path.resolve(HERE, "..", "..", "events", "taxonomy_hierarchy.json"), "utf8"));
  const live = new Set();
  for (const l1 of taxonomy.layer1) {
    for (const l2 of l1.layer2) {
      for (const l3 of l2.layer3) live.add(typeof l3 === "object" ? l3.code : l3);
    }
  }
  assert.deepEqual([...new Set(CATEGORIES_71)].sort(), [...live].sort());
});

test("consensus vectors (shared with Python port)", () => {
  for (const c of VECTORS.consensus_vectors) {
    const passes = c.passes.map((v) => ({ verdict: v }));
    const got = recomputeConsensus(passes, c.policy ?? "conservative_downgrade");
    for (const [k, want] of Object.entries(c.expected)) {
      assert.deepEqual(got[k], want,
        `${c.passes.join("+")} (${c.policy ?? "default"}): ${k} got ${got[k]}, want ${want}`);
    }
    assert.equal(got.verdict, got.consensus_verdict);
    if (!("had_dissent" in c.expected)) assert.ok(!("had_dissent" in got));
  }
});

test("recomputeConsensus rejects empty and invalid passes", () => {
  assert.throws(() => recomputeConsensus([]));
  assert.throws(() => recomputeConsensus([{ verdict: "CONTESTED" }]));
});

test("normTitle vectors (parity with build_verified_positives._norm_title)", () => {
  for (const [raw, expected] of VECTORS.norm_title_vectors) {
    assert.equal(normTitle(raw), expected, JSON.stringify(raw));
  }
});

test("dedupKey is stable and normalization-insensitive", () => {
  const a = dedupKey("fiji", 1987, "Rabuka Coup — May");
  const b = dedupKey("fiji", 1987, "rabuka  coup?? may");
  assert.match(a, /^[0-9a-f]{40}$/);
  assert.equal(a, b);
  assert.notEqual(a, dedupKey("fiji", 1988, "Rabuka Coup — May"));
});

test("registrableDomain strips subdomains, keeps two-part TLDs", () => {
  assert.equal(registrableDomain("https://en.wikipedia.org/wiki/X"), "wikipedia.org");
  assert.equal(registrableDomain("https://www.bbc.co.uk/news/1"), "bbc.co.uk");
  assert.equal(registrableDomain("https://britannica.com/a"), "britannica.com");
  assert.equal(registrableDomain("not a url"), null);
});

test("sourceIndependence: independent / same_domain / weak / n-a, order-independent", () => {
  const p = (src) => ({ source: src });
  assert.equal(sourceIndependence([p("https://en.wikipedia.org/x")]), "n/a");
  assert.equal(sourceIndependence([p("https://en.wikipedia.org/x"), p(null)]), "n/a");
  assert.equal(sourceIndependence(
    [p("https://en.wikipedia.org/x"), p("https://de.wikipedia.org/y")]), "weak");
  assert.equal(sourceIndependence(
    [p("https://en.wikipedia.org/x"), p("https://britannica.com/y")]), "independent");
  // partial overlap is same_domain regardless of pass order (same multiset → same label)
  assert.equal(sourceIndependence(
    [p("https://en.wikipedia.org/x"), p("https://britannica.com/y"),
     p("https://fr.wikipedia.org/z")]), "same_domain");
  assert.equal(sourceIndependence(
    [p("https://en.wikipedia.org/x"), p("https://fr.wikipedia.org/z"),
     p("https://britannica.com/y")]), "same_domain");
});

test("migrateEntry mirrors the Python migration", () => {
  const legacy = { year: 1969, title: "T", verdict: "TRUE", reason: "r",
    source: "https://en.wikipedia.org/x" };
  const out = migrateEntry({ ...legacy });
  assert.equal(out.verify_count, 1);
  assert.equal(out.consensus_verdict, "TRUE");
  assert.equal(out.consensus_status, "single");
  assert.equal(out.source_independence, "n/a");
  assert.equal(out.verifications[0].pass_n, 1);
  assert.equal(out.verifications[0].verifier.model, "claude-sonnet-pre-migration");
  assert.equal(migrateEntry(out), out);              // idempotent
  const malformed = { year: 1, title: "x", verdict: "VERIFIED" };
  assert.equal(migrateEntry(malformed), malformed);  // untouched
  const noSrc = migrateEntry({ year: 2, title: "y", verdict: "FALSE", reason: "no" });
  assert.ok(!("source" in noSrc));
});

test("cleanCuratedEvent emits exactly the 4 canonical keys", () => {
  const out = cleanCuratedEvent({ year: 1987, title: "T", description: "d",
    category: "military_coup", verified: true, verification_source: "x" });
  assert.deepEqual(Object.keys(out), ["year", "title", "description", "category"]);
});

test("fillTemplate inserts $-laden agent text verbatim (no substitution patterns)", () => {
  const out = fillTemplate("Event: __EVENT_JSON__ end", {
    __EVENT_JSON__: "aid worth US$$2bn and $& more and $' tail"
  });
  assert.equal(out, "Event: aid worth US$$2bn and $& more and $' tail end");
});

test("ledgerSettled mirrors the settled predicate", () => {
  assert.equal(ledgerSettled(undefined), false);
  assert.equal(ledgerSettled({ verify_count: 1, needs_tiebreak: false }), false);
  assert.equal(ledgerSettled({ verify_count: 2, needs_tiebreak: true }), false);
  assert.equal(ledgerSettled({ verify_count: 2, needs_tiebreak: false }), true);
});

test("buildVerificationEntry assembles v2 with consensus + independence", () => {
  const mk = (n, verdict, src) => ({ pass_n: n, verdict, reason: `r${n}`, source: src,
    verifier: { model: "claude-sonnet-5", date: "2026-07-02", method: "web_search" } });
  const agree = buildVerificationEntry(1969, "T", [
    mk(1, "TRUE", "https://en.wikipedia.org/x"), mk(2, "TRUE", "https://britannica.com/y")]);
  assert.equal(agree.verdict, "TRUE");
  assert.equal(agree.consensus_status, "double_confirmed");
  assert.equal(agree.source_independence, "independent");
  assert.equal(agree.verify_count, 2);
  assert.equal(agree.source, "https://britannica.com/y"); // latest confirming sourced pass
  assert.ok(isDoubleVerified(agree));

  const clash = buildVerificationEntry(1957, "T", [
    mk(1, "TRUE", null), mk(2, "FALSE", "https://jstor.org/z")]);
  assert.equal(clash.verdict, "CONTESTED");
  assert.equal(clash.needs_tiebreak, true);
  assert.match(clash.reason, /Tiebreak required/);
  assert.ok(!("source" in clash) || clash.source === null);
  assert.ok(!isDoubleVerified(clash)); // stays selectable for pass 3

  const resolved = buildVerificationEntry(1957, "T", [
    mk(1, "TRUE", null), mk(2, "FALSE", "https://jstor.org/z"), mk(3, "TRUE", "https://britannica.com/w")]);
  assert.equal(resolved.verdict, "TRUE");
  assert.equal(resolved.had_dissent, true); // founder spot-check queue marker
});

test("VERDICTS never contains CONTESTED (pass-level vocabulary)", () => {
  assert.ok(!VERDICTS.includes("CONTESTED"));
});

test("ACTIVE_TRENDS = 69 (taxonomy 71 minus the 2 deactivated Trends)", () => {
  assert.equal(CATEGORIES_71.length, 71);
  assert.equal(ACTIVE_TRENDS.length, 69);
  assert.deepEqual([...DEACTIVATED_TRENDS].sort(), ["epidemic_and_pandemic", "natural_disaster"]);
  for (const d of DEACTIVATED_TRENDS) assert.ok(!ACTIVE_TRENDS.includes(d));
  // all active are still canonical taxonomy codes
  for (const t of ACTIVE_TRENDS) assert.ok(CATEGORIES_71.includes(t));
});

test("trendTier maps n_pos to tier at the gates", () => {
  assert.equal(trendTier(60), "runnable");
  assert.equal(trendTier(59), "thin");
  assert.equal(trendTier(8), "thin");
  assert.equal(trendTier(7), "skip");
});

test("rankTrends: thin-closest-to-gate first, deactivated never appear, hazards deprioritized", () => {
  const pos = Object.fromEntries(ACTIVE_TRENDS.map((t) => [t, 100])); // all comfortably runnable
  pos.technology_breakthrough = 57;   // thin, gap 3 → should rank #1
  pos.digital_policy = 20;            // thin, gap 40
  pos.currency_crisis = 62;          // fragile-floor runnable
  pos.flood_and_cyclone = 58;        // thin gap 2 BUT hazard-overlap → deprioritized below tech
  const ranked = rankTrends(pos);
  assert.equal(ranked[0].trend, "technology_breakthrough");
  assert.ok(!ranked.some((r) => DEACTIVATED_TRENDS.includes(r.trend)));
  assert.equal(ranked.length, 69);
  const iTech = ranked.findIndex((r) => r.trend === "technology_breakthrough");
  const iFlood = ranked.findIndex((r) => r.trend === "flood_and_cyclone");
  assert.ok(iTech < iFlood, "hazard-overlap flood ranked below non-hazard tech despite smaller gap");
});

test("pickTrend skips a Trend already saturated for this pass", () => {
  const pos = Object.fromEntries(ACTIVE_TRENDS.map((t) => [t, 100]));
  pos.technology_breakthrough = 57;
  pos.environmental_policy = 56;
  const led = { trends: { technology_breakthrough: { candidates_added: 40 } } }; // saturated (>= target)
  assert.equal(pickTrend(led, pos).trend, "environmental_policy");
  assert.equal(pickTrend({ trends: {} }, pos).trend, "technology_breakthrough");
});

test("ledgerDepthReached generalizes across the depth ladder", () => {
  assert.equal(ledgerDepthReached({ verify_count: 2, needs_tiebreak: false }, 2), true);
  assert.equal(ledgerDepthReached({ verify_count: 2, needs_tiebreak: false }, 3), false); // want triple
  assert.equal(ledgerDepthReached({ verify_count: 3, needs_tiebreak: false }, 3), true);
  assert.equal(ledgerDepthReached({ verify_count: 3, needs_tiebreak: true }, 3), false);  // still contested
  assert.equal(ledgerDepthReached(undefined, 2), false);
});

test("depthWhy is blindness-safe (no prior-verdict/direction leak)", () => {
  for (const d of [0, 1, 2]) {
    const w = depthWhy(d);
    // must NOT reveal the event's current label or which way an earlier pass went
    assert.doesNotMatch(w, /\b(previous verdict|prior pass|re-verify|currently (true|false)|already (confirmed|verified as)|was (true|false))\b/i);
    // must keep both error directions explicitly equal-cost (the intended framing)
    assert.match(w, /a wrong TRUE and a wrong FALSE are equally costly/i);
  }
});

test("MAX_VERIFY_DEPTH is 3 (double then triple)", () => {
  assert.equal(MAX_VERIFY_DEPTH, 3);
  assert.equal(RUNNABLE_GATE, 60);
});

test("CONSENSUS_POLICY matches the ratified policy file (B1)", async () => {
  const { CONSENSUS_POLICY } = await import("./schemas.mjs");
  const p = path.resolve(HERE, "..", "..", "events", "_ledger", "consensus_policy.json");
  const ratified = JSON.parse(fs.readFileSync(p, "utf8")).active_policy;
  assert.equal(CONSENSUS_POLICY, ratified);
});
