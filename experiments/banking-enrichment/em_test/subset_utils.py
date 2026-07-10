"""Shared EM-vs-advanced subset masking (PLAN.md §11 Steps 2-3), factored out of
run_em_baseline.py so the identical logic serves BOTH the EM-eligible baseline/candidate
scoring (stdebt_reserves, m2_reserves) AND the advanced-only baseline/candidate scoring
(credit_growth_3y_fd, §11 Step 3's secondary/non-gating track) -- one mask function, never
two near-duplicate inline `[... for c, y in zip(...)]` comprehensions drifting apart.

Pure (dict/list only, no pandas/numpy) -- host-testable, see test_subset_utils.py.
"""
from __future__ import annotations

VALID_SUBSETS = ("em", "advanced")


def resolve_subset_mask(
    rows: list[tuple[str, int]],
    resolved_by_key: dict[tuple[str, int], bool],
    subset: str,
) -> list[bool]:
    """For each (country, year) in `rows`, return True iff it belongs to `subset`.

    `resolved_by_key` maps a resolved (country, year) -> em_eligible (True=EM-eligible,
    False=advanced), exactly as produced by `em_classification.classify_rows_tolerant`
    (see run_em_baseline.py's `resolved_by_key` construction). A row absent from
    `resolved_by_key` (unresolved -- no cohort data, per em_commitment.json's
    `unresolved_positives`) is excluded from BOTH subsets, never guessed into either.

    subset="em" selects em_eligible=True rows; subset="advanced" selects
    em_eligible=False rows. For any RESOLVED row, exactly one of the two subsets claims
    it (they are a strict partition of the resolved rows; unresolved rows belong to
    neither).
    """
    if subset not in VALID_SUBSETS:
        raise ValueError(f"resolve_subset_mask: subset must be one of {VALID_SUBSETS}, got {subset!r}")
    want_em = subset == "em"
    out: list[bool] = []
    for key in rows:
        em_eligible = resolved_by_key.get(key)
        if em_eligible is None:
            out.append(False)
        else:
            out.append(em_eligible if want_em else (not em_eligible))
    return out
