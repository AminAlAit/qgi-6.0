"""EX-ANTE OECD/advanced-economy country scope for the economic_recession reboot.

Defined by ACTUAL OECD membership (38 members as of 2024) intersected with the 106-country
`positives.csv` roster, PLUS the one non-OECD country in that roster that is an "advanced
economy" per the IMF WEO classification (Singapore). This is an EXTERNAL, independently
verifiable criterion -- membership in a real-world international body / a published IMF
classification -- deliberately NOT derived from which countries happen to have BIS/WB
indicator data. Scoping to "wherever the data already covers" would be circular (it would
manufacture a high coverage number by definition); scoping to "wherever an outside body
already calls advanced" is the honest, falsifiable alternative, per the methodology
charter's insistence on pre-registered, non-post-hoc criteria.

The resulting count (see `test_oecd_scope_count_is_in_task_ballpark`) is reported AS-IS, not
adjusted to hit the task brief's "~30-42 countries" prior estimate -- per the task's own
mandate: "this is the real N, not the roster estimate."
"""
from __future__ import annotations

import pandas as pd

# OECD's 38 members (2024) that are ALSO present in the 106-country economic_recession
# roster (`positives.csv` country_ids), hand-verified against the OECD's published member
# list, 2026-07-11. Countries in the 38-member list with NO event in our roster (e.g.
# Australia, Austria, Belgium, Denmark, Ireland, Latvia, Luxembourg, New Zealand, Slovenia,
# Sweden, Switzerland) are correctly absent here -- they simply have no recession event in
# this trend's positives.csv to scope.
_OECD_MEMBERS_IN_ROSTER = {
    "canada", "chile", "colombia", "costa_rica", "czechia", "estonia", "finland", "france",
    "germany", "greece", "hungary", "iceland", "israel", "italy", "japan", "south_korea",
    "lithuania", "mexico", "netherlands", "norway", "poland", "portugal", "slovakia", "spain",
    "turkiye", "united_kingdom", "united_states",
}

# Non-OECD "advanced economy" per IMF WEO classification, present in the roster.
_IMF_ADVANCED_NON_OECD_IN_ROSTER = {"singapore"}

OECD_SCOPED_COUNTRY_IDS: frozenset[str] = frozenset(
    _OECD_MEMBERS_IN_ROSTER | _IMF_ADVANCED_NON_OECD_IN_ROSTER
)


def filter_positives_to_oecd_scope(positives: pd.DataFrame) -> pd.DataFrame:
    """`positives` has a `country_id` column (raw `positives.csv` convention). Returns only
    the rows whose `country_id` is in `OECD_SCOPED_COUNTRY_IDS`, all other rows/columns
    (including `event_year`) untouched."""
    return positives[positives["country_id"].isin(OECD_SCOPED_COUNTRY_IDS)].reset_index(drop=True)
