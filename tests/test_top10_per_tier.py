"""Unit tests for top10_per_tier.py pure functions.

top10_per_tier.py defines two pure functions:
  - zscore_per_country()  — identical logic to run_backtest.zscore_per_country
                            and generate_country_risks.zscore_per_country
  - rank_fusion()         — identical logic to generate_country_risks.rank_fusion
                            (but named rank_fusion not rank_fusion_ensemble)

Both are already tested thoroughly in:
  - test_generate_country_risks.py  (TestZscorePerCountry, TestRankFusion)
  - test_run_backtest.py            (TestZscorePerCountryBacktest, TestRankFusionEnsemble)

The top10_per_tier.py module runs Athena queries at import time (module-level
calls to rq() on lines 63-88) which means it CANNOT be imported in an offline
test context without mocking boto3.

Deferred: the module-level Athena execution pattern makes unit testing
impossible without refactoring the script into a callable main() function
(same fix needed as other scripts). Import-time side-effects are an
integration testing anti-pattern.

Note on duplication: if the three zscore_per_country / rank_fusion copies
are ever consolidated into qgi-ml/shared/scoring.py (or similar), a single
test file would cover all three.

#373 test coverage audit — pure functions not re-tested (already covered);
module-level Athena calls prevent import.
"""
import pytest


def test_zscore_and_rank_fusion_already_covered():
    """top10_per_tier.py implements zscore_per_country + rank_fusion.

    Both are already tested in:
      - test_generate_country_risks.py (TestZscorePerCountry, TestRankFusion)
      - test_run_backtest.py (TestZscorePerCountryBacktest, TestRankFusionEnsemble)

    Module-level Athena calls at import time prevent standalone unit testing.
    This is a known structural issue — tracked under #373.
    """
    pytest.skip(
        "top10_per_tier.py: zscore_per_country and rank_fusion are already "
        "tested in test_generate_country_risks.py and test_run_backtest.py. "
        "Module-level Athena calls prevent import in offline tests. "
        "Refactor to callable main() to unblock."
    )
