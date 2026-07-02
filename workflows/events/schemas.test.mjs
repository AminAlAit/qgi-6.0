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

import { CATEGORIES_71, SHARDS, VERDICTS, normTitle, recomputeConsensus } from "./schemas.mjs";
import {
  buildVerificationEntry, cleanCuratedEvent, dedupKey, eventTier, fillTemplate,
  isDoubleVerified, ledgerSettled, migrateEntry, registrableDomain, sourceIndependence
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

test("eventTier encodes §5.2 priority", () => {
  assert.equal(eventTier("france", "currency_crisis"), 1);        // fragile floor
  assert.equal(eventTier("ukraine", "urban_development"), 2);     // low-join country
  assert.equal(eventTier("france", "elections_and_voting"), 3);   // flagship
  assert.equal(eventTier("france", "urban_development"), 4);
  assert.equal(eventTier("ukraine", "currency_crisis"), 1);       // category beats country
});

test("VERDICTS never contains CONTESTED (pass-level vocabulary)", () => {
  assert.ok(!VERDICTS.includes("CONTESTED"));
});

test("CONSENSUS_POLICY matches the ratified policy file (B1)", async () => {
  const { CONSENSUS_POLICY } = await import("./schemas.mjs");
  const p = path.resolve(HERE, "..", "..", "events", "_ledger", "consensus_policy.json");
  const ratified = JSON.parse(fs.readFileSync(p, "utf8")).active_policy;
  assert.equal(CONSENSUS_POLICY, ratified);
});
