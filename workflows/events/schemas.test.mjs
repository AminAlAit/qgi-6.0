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
  buildVerificationEntry, dedupKey, eventTier, isDoubleVerified, mergeCurated,
  migrateEntry, registrableDomain, sourceIndependence
} from "./_lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VECTORS = JSON.parse(fs.readFileSync(
  path.resolve(HERE, "..", "..", "tests", "consensus_vectors.json"), "utf8"));

test("CATEGORIES_71 has exactly 71 unique codes", () => {
  assert.equal(CATEGORIES_71.length, 71);
  assert.equal(new Set(CATEGORIES_71).size, 71);
  assert.equal(SHARDS.length, 8);
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

test("sourceIndependence: independent / same_domain / weak / n-a", () => {
  const p = (src) => ({ source: src });
  assert.equal(sourceIndependence([p("https://en.wikipedia.org/x")]), "n/a");
  assert.equal(sourceIndependence([p("https://en.wikipedia.org/x"), p(null)]), "n/a");
  assert.equal(sourceIndependence(
    [p("https://en.wikipedia.org/x"), p("https://de.wikipedia.org/y")]), "weak");
  assert.equal(sourceIndependence(
    [p("https://en.wikipedia.org/x"), p("https://britannica.com/y")]), "independent");
  assert.equal(sourceIndependence(
    [p("https://en.wikipedia.org/x"), p("https://britannica.com/y"),
     p("https://fr.wikipedia.org/z")]), "same_domain");
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

test("mergeCurated dedups against existing and within batch, emits 4 keys only", () => {
  const existing = [{ year: 1970, title: "Fiji Independence", description: "d", category: "democratic_transition" }];
  const { fresh, dupExisting, dupWithinBatch } = mergeCurated(existing, [
    { year: 1970, title: "FIJI — Independence!", description: "dup of existing", category: "democratic_transition" },
    { year: 1987, title: "First Rabuka Coup", description: "d", category: "military_coup", verified: true },
    { year: 1987, title: "First  Rabuka  Coup", description: "dup in batch", category: "military_coup" },
  ]);
  assert.equal(fresh.length, 1);
  assert.equal(dupExisting.length, 1);
  assert.equal(dupWithinBatch.length, 1);
  assert.deepEqual(Object.keys(fresh[0]), ["year", "title", "description", "category"]); // never verified/verification_source
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
