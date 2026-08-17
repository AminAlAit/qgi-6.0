"""Unit tests for the GPR pipeline data layer (movers + ingest logic).
No BigQuery calls: bq-touching functions are monkeypatched, pure logic is exercised directly.
Guards the review-found bugs: all-7-days week_present, Sunday-boundary assert, lag buffer,
mover ranking + n_compared."""
import os, sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "src"))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "gpr-build"))
import pytest
import movers, ingest


# ---- movers.compute_movers (pure) ----

FIPS2ISO = {"CO": "COL", "EG": "EGY", "BE": "BEL", "XX": "XXX"}
TIERS = {"COL": "C", "EGY": "A", "BEL": "A"}
NAMES = {"COL": "Colombia", "EGY": "Egypt", "BEL": "Belgium"}


def _rows(triples):
    return [{"country_code": c, "bucket": b, "gpr_share": s} for c, b, s in triples]


def test_movers_ranking_and_pct():
    rows = _rows([
        ("CO", "2026-05-18", 0.10), ("CO", "2026-05-25", 0.20),   # +100%
        ("EG", "2026-05-18", 0.50), ("EG", "2026-05-25", 0.55),   # +10%
        ("BE", "2026-05-18", 0.40), ("BE", "2026-05-25", 0.20),   # -50%
    ])
    r = movers.compute_movers(rows, FIPS2ISO, TIERS, NAMES, top_n=5)
    assert r["latest_week"] == "2026-05-25" and r["prior_week"] == "2026-05-18"
    assert [m["name"] for m in r["risers"]] == ["Colombia", "Egypt"]
    assert r["risers"][0]["pct"] == 100.0 and r["risers"][0]["tier"] == "C"
    assert [m["name"] for m in r["fallers"]] == ["Belgium"]
    assert r["fallers"][0]["pct"] == -50.0
    assert r["n_compared"] == 3


def test_movers_skips_countries_missing_a_week_or_zero_prior():
    rows = _rows([
        ("CO", "2026-05-18", 0.10), ("CO", "2026-05-25", 0.20),   # ok
        ("EG", "2026-05-25", 0.55),                                 # only latest -> skipped
        ("XX", "2026-05-18", 0.0),  ("XX", "2026-05-25", 0.3),     # prior 0 -> skipped (div guard)
    ])
    r = movers.compute_movers(rows, FIPS2ISO, TIERS, NAMES, top_n=5)
    assert r["n_countries"] == 3 and r["n_compared"] == 1
    assert [m["name"] for m in r["risers"]] == ["Colombia"]


def test_movers_needs_two_weeks():
    with pytest.raises(RuntimeError):
        movers.compute_movers(_rows([("CO", "2026-05-25", 0.2)]), FIPS2ISO, TIERS, NAMES)


# ---- ingest week-boundary + idempotency logic (bq stubbed) ----

def test_monday():
    assert ingest.monday(date(2026, 5, 31)) == date(2026, 5, 25)   # Sunday -> its Monday
    assert ingest.monday(date(2026, 5, 25)) == date(2026, 5, 25)   # Monday -> itself


def test_target_weeks_happy_path(monkeypatch):
    monkeypatch.setattr(ingest, "table_max_date", lambda: date(2026, 5, 31))  # a Sunday
    monkeypatch.setattr(ingest, "week_present", lambda ws: False)
    weeks = ingest.target_weeks(date(2026, 7, 13))
    assert weeks[0] == date(2026, 6, 1)           # first week after coverage
    assert weeks[-1] == date(2026, 6, 29)         # lag-buffered latest complete
    assert all(w.weekday() == 0 for w in weeks)   # all Mondays


def test_target_weeks_rejects_offboundary_tail(monkeypatch):
    monkeypatch.setattr(ingest, "table_max_date", lambda: date(2026, 6, 1))   # a Monday, NOT a Sunday
    with pytest.raises(SystemExit):
        ingest.target_weeks(date(2026, 7, 13))


def test_target_weeks_lag_buffer_excludes_too_recent(monkeypatch):
    # as_of only 1 day after a week closes -> that week is inside the lag buffer, excluded
    monkeypatch.setattr(ingest, "table_max_date", lambda: date(2026, 5, 31))
    monkeypatch.setattr(ingest, "week_present", lambda ws: False)
    weeks = ingest.target_weeks(date(2026, 6, 8))   # week 06-01..06-07 closed 06-07; only 1 day of buffer
    assert date(2026, 6, 1) not in weeks            # not yet lag-clear


def test_week_present_requires_all_seven_days(monkeypatch):
    # simulate INFORMATION_SCHEMA returning a distinct-partition count
    def fake_run(sql, **kw):
        return [{"n": "5"}]   # only 5 of 7 days landed
    monkeypatch.setattr(ingest, "_run", fake_run)
    assert ingest.week_present(date(2026, 6, 1)) is False
    monkeypatch.setattr(ingest, "_run", lambda sql, **kw: [{"n": "7"}])
    assert ingest.week_present(date(2026, 6, 1)) is True
