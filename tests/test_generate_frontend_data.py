"""Unit tests for generate_frontend_data.py pure functions.

Deferred: generate_frontend_data.py has NO extractable pure functions at
module scope. Every function (generate_partners_index, generate_pattern_density,
generate_structural_twins, generate_pair_windows, generate_analogues,
generate_indicator_trajectories) takes a live `athena` boto3 client as its
first argument and immediately calls run_athena_query().

The only pure-ish logic (name_to_slug, partner sorting, structural-twins
top-5 selection, density accumulation) is embedded inside those Athena-bound
functions with no separate callsite.

Recommendation for integration follow-up:
  - Extract name_to_slug() to module level (it is duplicated vs
    generate_country_risks.py's equivalent transform).
  - Extract _build_partners_index_from_rows(rows, id_to_name, id_to_alpha2)
    as a pure helper so it can be unit-tested with hand-crafted row lists.
  - Extract _top_n_twins(pairs_dict, n=5) as a pure helper.

Until those extractions happen, meaningful tests require mocking boto3 at the
client level — which is integration-level, not unit-level.

#373 test coverage audit — deferred: integration-level test harness needed.
"""
import pytest


def test_deferred_integration_level():
    """Placeholder — pure functions not yet extracted from Athena-bound functions.

    See module docstring above for the specific extractions needed.
    Tracked under #373.
    """
    pytest.skip(
        "generate_frontend_data.py: all business logic is embedded inside "
        "Athena-calling functions. Pure helpers must be extracted before "
        "unit tests can be written. See module docstring."
    )
