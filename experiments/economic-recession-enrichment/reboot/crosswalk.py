"""country_id -> ISO3 (World Bank API join key) / ISO2 (BIS SDMX `REF_AREA` / `BORROWERS_CTY`
join key) crosswalk for the 106 countries in `economic_recession`'s
`data/shape_inputs_v2/economic_recession/positives.csv` (250 events, 1950-2021).

`normalize_country_id` is a VERBATIM copy of
`experiments/economic-recession-enrichment/screen_coverage.py`'s function of the same name
(itself a verbatim copy of `run_f_ml_1_poc.normalize_country_id` -- project convention, see
that module's docstring for why this is duplicated rather than imported). Reproducing it here
-- rather than hand-typing a `country_name` per row -- guarantees `CROSSWALK`'s display name is
byte-identical to what `screen_coverage.py` derives from `positives.csv` at screen time, which
is the actual join key the coverage gate uses. This module intentionally does NOT try to
match World Bank's own `country.value` API field (which differs -- e.g. WB says "Cote
d'Ivoire", "Korea, Rep.", "Congo, Dem. Rep."); every `build_*.py` panel builder in this
`reboot/` dir re-derives its `country` column from `iso3_to_country_id` + `normalize_country_id`
so all panels and the screen join on the SAME convention, independent of any one source's
raw naming.
"""
from __future__ import annotations

# Verbatim copy of screen_coverage.py's COUNTRY_NAME_OVERRIDES + normalize_country_id.
COUNTRY_NAME_OVERRIDES: dict[str, str] = {
    "democratic_republic_of_congo": "The Democratic Republic of the Congo",
    "guinea_bissau": "Guinea-Bissau",
    "republic_of_congo": "Republic of the Congo",
    "timor_leste": "Timor-Leste",
}


def normalize_country_id(country_id: str) -> str:
    if country_id in COUNTRY_NAME_OVERRIDES:
        return COUNTRY_NAME_OVERRIDES[country_id]
    return country_id.replace("_", " ").title()


# country_id (positives.csv convention) -> (iso3, iso2). iso3 is the World Bank API join key
# (`countryiso3code` / `/v2/country/<iso3>/...`); iso2 is the BIS SDMX join key
# (`BORROWERS_CTY` in WS_CREDIT_GAP, `REF_AREA` in WS_SPP) -- both are standard ISO 3166-1
# codes, hand-verified against the 106 positives.csv country_ids (2026-07-11).
_ISO_CODES: dict[str, tuple[str, str]] = {
    "afghanistan": ("AFG", "AF"),
    "algeria": ("DZA", "DZ"),
    "angola": ("AGO", "AO"),
    "argentina": ("ARG", "AR"),
    "armenia": ("ARM", "AM"),
    "belarus": ("BLR", "BY"),
    "bhutan": ("BTN", "BT"),
    "bolivia": ("BOL", "BO"),
    "bosnia_and_herzegovina": ("BIH", "BA"),
    "botswana": ("BWA", "BW"),
    "brazil": ("BRA", "BR"),
    "brunei": ("BRN", "BN"),
    "burundi": ("BDI", "BI"),
    "cabo_verde": ("CPV", "CV"),
    "cameroon": ("CMR", "CM"),
    "canada": ("CAN", "CA"),
    "chad": ("TCD", "TD"),
    "chile": ("CHL", "CL"),
    "china": ("CHN", "CN"),
    "colombia": ("COL", "CO"),
    "costa_rica": ("CRI", "CR"),
    "croatia": ("HRV", "HR"),
    "cuba": ("CUB", "CU"),
    "czechia": ("CZE", "CZ"),
    "democratic_republic_of_congo": ("COD", "CD"),
    "dominican_republic": ("DOM", "DO"),
    "ecuador": ("ECU", "EC"),
    "egypt": ("EGY", "EG"),
    "eritrea": ("ERI", "ER"),
    "estonia": ("EST", "EE"),
    "ethiopia": ("ETH", "ET"),
    "finland": ("FIN", "FI"),
    "france": ("FRA", "FR"),
    "georgia": ("GEO", "GE"),
    "germany": ("DEU", "DE"),
    "ghana": ("GHA", "GH"),
    "greece": ("GRC", "GR"),
    "hungary": ("HUN", "HU"),
    "iceland": ("ISL", "IS"),
    "india": ("IND", "IN"),
    "indonesia": ("IDN", "ID"),
    "iran": ("IRN", "IR"),
    "iraq": ("IRQ", "IQ"),
    "israel": ("ISR", "IL"),
    "italy": ("ITA", "IT"),
    "ivory_coast": ("CIV", "CI"),
    "jamaica": ("JAM", "JM"),
    "japan": ("JPN", "JP"),
    "jordan": ("JOR", "JO"),
    "kuwait": ("KWT", "KW"),
    "kyrgyzstan": ("KGZ", "KG"),
    "lebanon": ("LBN", "LB"),
    "liberia": ("LBR", "LR"),
    "lithuania": ("LTU", "LT"),
    "madagascar": ("MDG", "MG"),
    "malaysia": ("MYS", "MY"),
    "mauritania": ("MRT", "MR"),
    "mexico": ("MEX", "MX"),
    "moldova": ("MDA", "MD"),
    "mongolia": ("MNG", "MN"),
    "morocco": ("MAR", "MA"),
    "namibia": ("NAM", "NA"),
    "netherlands": ("NLD", "NL"),
    "niger": ("NER", "NE"),
    "nigeria": ("NGA", "NG"),
    "north_korea": ("PRK", "KP"),
    "north_macedonia": ("MKD", "MK"),
    "norway": ("NOR", "NO"),
    "oman": ("OMN", "OM"),
    "pakistan": ("PAK", "PK"),
    "palestine": ("PSE", "PS"),
    "panama": ("PAN", "PA"),
    "paraguay": ("PRY", "PY"),
    "peru": ("PER", "PE"),
    "philippines": ("PHL", "PH"),
    "poland": ("POL", "PL"),
    "portugal": ("PRT", "PT"),
    "romania": ("ROU", "RO"),
    "russia": ("RUS", "RU"),
    "saudi_arabia": ("SAU", "SA"),
    "sierra_leone": ("SLE", "SL"),
    "singapore": ("SGP", "SG"),
    "slovakia": ("SVK", "SK"),
    "south_africa": ("ZAF", "ZA"),
    "south_korea": ("KOR", "KR"),
    "south_sudan": ("SSD", "SS"),
    "spain": ("ESP", "ES"),
    "sudan": ("SDN", "SD"),
    "suriname": ("SUR", "SR"),
    "syria": ("SYR", "SY"),
    "tajikistan": ("TJK", "TJ"),
    "tanzania": ("TZA", "TZ"),
    "thailand": ("THA", "TH"),
    "togo": ("TGO", "TG"),
    "trinidad_and_tobago": ("TTO", "TT"),
    "tunisia": ("TUN", "TN"),
    "turkiye": ("TUR", "TR"),
    "turkmenistan": ("TKM", "TM"),
    "united_arab_emirates": ("ARE", "AE"),
    "united_kingdom": ("GBR", "GB"),
    "united_states": ("USA", "US"),
    "uruguay": ("URY", "UY"),
    "venezuela": ("VEN", "VE"),
    "vietnam": ("VNM", "VN"),
    "yemen": ("YEM", "YE"),
    "zambia": ("ZMB", "ZM"),
}

CROSSWALK: dict[str, dict[str, str]] = {
    cid: {"iso3": iso3, "iso2": iso2, "country_name": normalize_country_id(cid)}
    for cid, (iso3, iso2) in _ISO_CODES.items()
}

_ISO3_TO_CID: dict[str, str] = {row["iso3"]: cid for cid, row in CROSSWALK.items()}
_ISO2_TO_CID: dict[str, str] = {row["iso2"]: cid for cid, row in CROSSWALK.items()}


def iso3_to_country_id(iso3: str) -> str | None:
    return _ISO3_TO_CID.get(iso3)


def iso2_to_country_id(iso2: str) -> str | None:
    return _ISO2_TO_CID.get(iso2)


def country_id_to_display_name(country_id: str) -> str | None:
    row = CROSSWALK.get(country_id)
    return row["country_name"] if row else None
