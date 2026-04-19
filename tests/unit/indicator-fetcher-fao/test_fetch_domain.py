"""
Unit tests for batch/indicator-fetcher-fao/src/fetch_domain.py (#241 Phase B).

Tests the FAOSTAT bulk-download fetcher in isolation. The network
download, S3 I/O, and DDB writes are all mocked. Covers:

- extract_indicator: filters domain CSV to rows for one (item_code,
  element_code), attaches QGI country IDs, drops unmapped areas
- write_parquet: partitions by (year, country_id), writes one
  Parquet object per partition to S3 under the correct key
- fetch_domain_csv retries + ZIP extraction logic
- main(): end-to-end happy path + failure paths (download fail,
  CSV parse fail) both write FAILED tracker rows + decrement counter
  correctly
- country-map loader skips entries without fao_area_code (Kosovo)
"""
import importlib.util
import io
import json
import os
import sys
import types
import zipfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

_FETCHER_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "batch"
    / "indicator-fetcher-fao"
    / "src"
    / "fetch_domain.py"
)


_ENV = {
    "AWS_REGION": "eu-central-1",
    "S3_BUCKET": "test-bucket",
    "RUN_ID": "test-run-1",
    "DOMAIN_CODE": "FS",
    "INDICATORS_JSON": json.dumps([
        {"id_string": "FA-01", "numeric_id": 59,
         "item_code": 21010, "element_code": 6121},
    ]),
    "JITTER_MIN_S": "0",  # speed up tests
    "JITTER_MAX_S": "0",
}


_COUNTRY_MAP_CSV = (
    "qgi_country_id,qgi_name,m49_code,iso_alpha3,fao_area_code,notes\n"
    "1,Afghanistan,4,AFG,2,\n"
    "23,Brazil,76,BRA,21,\n"
    "115,Kosovo,,XKX,,FAO folds into Serbia\n"
    "195,Turkey,792,TUR,223,FAO renamed 2022\n"
)


_FAOSTAT_CSV_SAMPLE = (
    '"Area Code","Area","Item Code","Item","Element Code","Element","Year","Value","Unit","Flag"\n'
    '2,"Afghanistan",21010,"Prevalence of undernourishment",6121,"Value",2020,29.8,"%","E"\n'
    '2,"Afghanistan",21010,"Prevalence of undernourishment",6121,"Value",2021,28.3,"%","E"\n'
    '21,"Brazil",21010,"Prevalence of undernourishment",6121,"Value",2020,3.2,"%","E"\n'
    '5000,"Africa",21010,"Prevalence of undernourishment",6121,"Value",2020,20.0,"%","A"\n'  # regional aggregate — dropped
    '2,"Afghanistan",21013,"Other item",6128,"Value",2020,99.0,"%","E"\n'  # different item, excluded
)


@pytest.fixture(autouse=True)
def _env_vars(monkeypatch):
    for k, v in _ENV.items():
        monkeypatch.setenv(k, v)


def _load_fetcher(s3_get_side_effect=None):
    """Load the fetcher module with boto3 clients mocked.

    s3_get_side_effect: optional callable(Bucket, Key) → response dict.
    Default: return the country map CSV for the country-m49-map key.
    """
    s3_client = MagicMock()

    def default_side_effect(*, Bucket, Key):
        if "country-m49-map" in Key:
            return {"Body": io.BytesIO(_COUNTRY_MAP_CSV.encode("utf-8"))}
        raise AssertionError(f"unexpected s3.get_object({Bucket}, {Key})")

    s3_client.get_object.side_effect = s3_get_side_effect or default_side_effect

    ddb_resource = MagicMock()
    counter_table = MagicMock()
    tracker_table = MagicMock()
    values_table = MagicMock()
    ddb_resource.Table.side_effect = lambda name: {
        "qgi-pipeline-a-counter": counter_table,
        "qgi-indicator-updates": tracker_table,
        "qgi-indicator-values": values_table,
    }.get(name, MagicMock())

    def client_factory(name, *a, **kw):
        return {"s3": s3_client}.get(name, MagicMock())

    boto3_stub = types.ModuleType("boto3")
    boto3_stub.client = MagicMock(side_effect=client_factory)
    boto3_stub.resource = MagicMock(return_value=ddb_resource)

    with patch.dict(sys.modules, {"boto3": boto3_stub}):
        spec = importlib.util.spec_from_file_location(
            "fetch_domain", str(_FETCHER_PATH)
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    return mod, s3_client, counter_table, tracker_table


# ---------------------------------------------------------------------- #
# load_country_map                                                       #
# ---------------------------------------------------------------------- #


def test_load_country_map_skips_rows_without_fao_code():
    """Kosovo has no fao_area_code → should not appear in the map."""
    mod, _, _, _ = _load_fetcher()
    cm = mod.load_country_map()
    # Afghanistan (fao=2), Brazil (fao=21), Turkey (fao=223) — all present
    assert cm[2]["qgi_country_id"] == 1
    assert cm[21]["qgi_country_id"] == 23
    assert cm[223]["qgi_country_id"] == 195
    # Kosovo has empty fao_area_code → no entry
    assert not any(entry["qgi_country_id"] == 115 for entry in cm.values())


# ---------------------------------------------------------------------- #
# extract_indicator                                                      #
# ---------------------------------------------------------------------- #


def test_extract_indicator_filters_by_item_and_element_code():
    """Only rows matching (item_code, element_code) survive. Other
    items (21013 in the fixture) are dropped."""
    mod, _, _, _ = _load_fetcher()
    df_domain = pd.read_csv(io.StringIO(_FAOSTAT_CSV_SAMPLE))
    country_map = mod.load_country_map()
    result = mod.extract_indicator(
        df_domain,
        {"id_string": "FA-01", "item_code": 21010, "element_code": 6121},
        country_map,
    )
    # 3 rows match the item+element, but 1 is a regional aggregate (Area
    # Code 5000, "Africa") with no QGI mapping → dropped. Remaining: 2.
    assert len(result) == 3  # wait: Afghanistan has 2 years + Brazil has 1 = 3
    assert set(result["country_id"]) == {1, 23}


def test_extract_indicator_drops_unmapped_areas():
    """Regional aggregates (FAO area codes that don't map to QGI
    countries) are silently dropped. The test fixture has 'Africa'
    (fao_area_code=5000) which should not appear in the output."""
    mod, _, _, _ = _load_fetcher()
    df_domain = pd.read_csv(io.StringIO(_FAOSTAT_CSV_SAMPLE))
    country_map = mod.load_country_map()
    result = mod.extract_indicator(
        df_domain,
        {"id_string": "FA-01", "item_code": 21010, "element_code": 6121},
        country_map,
    )
    # No row with country_id referring to an unmapped FAO code
    # (Africa=5000 was in the fixture; it's dropped).
    assert 5000 not in result["country_id"].values


def test_extract_indicator_empty_when_no_match():
    """If the (item_code, element_code) pair doesn't exist in the CSV,
    return an empty DataFrame instead of raising."""
    mod, _, _, _ = _load_fetcher()
    df_domain = pd.read_csv(io.StringIO(_FAOSTAT_CSV_SAMPLE))
    country_map = mod.load_country_map()
    result = mod.extract_indicator(
        df_domain,
        {"id_string": "FA-99", "item_code": 99999, "element_code": 99999},
        country_map,
    )
    assert len(result) == 0
    assert list(result.columns) == ["country_id", "country_name", "year", "value"]


# ---------------------------------------------------------------------- #
# write_parquet                                                          #
# ---------------------------------------------------------------------- #


def test_write_parquet_partitions_by_year_and_country():
    """One Parquet per (year, country_id) partition. Keys match the
    WB fetcher's layout so Glue crawlers don't need provider-specific
    handling."""
    mod, s3_client, _, _ = _load_fetcher()
    df = pd.DataFrame([
        {"country_id": 1, "country_name": "Afghanistan", "year": 2020, "value": 29.8},
        {"country_id": 1, "country_name": "Afghanistan", "year": 2021, "value": 28.3},
        {"country_id": 23, "country_name": "Brazil", "year": 2020, "value": 3.2},
    ])
    n = mod.write_parquet(df, {"id_string": "FA-01"})
    assert n == 3  # 3 (year, country_id) partitions

    # Inspect the keys used
    keys = [c.kwargs["Key"] for c in s3_client.put_object.call_args_list]
    assert "pipeline-A-indicator-extractor/output/parquet/FA-01/year=2020/country=1/data.parquet" in keys
    assert "pipeline-A-indicator-extractor/output/parquet/FA-01/year=2021/country=1/data.parquet" in keys
    assert "pipeline-A-indicator-extractor/output/parquet/FA-01/year=2020/country=23/data.parquet" in keys


def test_write_parquet_empty_df_is_noop():
    """An empty DataFrame (indicator with no matching rows) emits 0
    Parquet objects and doesn't crash."""
    mod, s3_client, _, _ = _load_fetcher()
    df = pd.DataFrame(columns=["country_id", "country_name", "year", "value"])
    n = mod.write_parquet(df, {"id_string": "FA-01"})
    assert n == 0
    # No put_object calls since there's nothing to write (country-map
    # load was from a different branch — patch it out by checking only
    # Parquet-key calls specifically).
    parquet_calls = [
        c for c in s3_client.put_object.call_args_list
        if "parquet" in c.kwargs.get("Key", "")
    ]
    assert parquet_calls == []


# ---------------------------------------------------------------------- #
# fetch_domain_csv (ZIP handling)                                        #
# ---------------------------------------------------------------------- #


def _build_zip(csv_bytes: bytes, inner_filename: str = "FS_E_All_Data_(Normalized).csv") -> bytes:
    """Build an in-memory ZIP containing one CSV."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(inner_filename, csv_bytes)
    return buf.getvalue()


def test_fetch_domain_csv_extracts_main_csv_skipping_flags_file():
    """ZIPs sometimes contain a flags CSV alongside the main one. The
    fetcher must pick the main one, not the flags one."""
    mod, _, _, _ = _load_fetcher()
    # Build a ZIP with TWO CSVs: a flags one + the main data
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("FS_E_Flags.csv", "flag_code,flag_meaning\nE,Estimate\n")
        zf.writestr("FS_E_All_Data_(Normalized).csv", _FAOSTAT_CSV_SAMPLE)
    zip_bytes = buf.getvalue()

    fake_response = MagicMock(content=zip_bytes)
    fake_response.raise_for_status = MagicMock()
    with patch.object(mod, "requests") as mock_req:
        mock_req.get = MagicMock(return_value=fake_response)
        csv = mod.fetch_domain_csv("FS")
    # Main CSV bytes — should contain the Afghanistan / Brazil rows
    assert b"Afghanistan" in csv
    assert b"Brazil" in csv
    # NOT the flags content
    assert b"flag_meaning" not in csv


def test_fetch_domain_csv_retries_on_network_error():
    """5 exponential-backoff attempts on the HTTP GET. 4 failures then
    1 success should still succeed (attempts 1-4 fail, attempt 5 OK)."""
    mod, _, _, _ = _load_fetcher()
    zip_bytes = _build_zip(_FAOSTAT_CSV_SAMPLE.encode("utf-8"))

    call_count = {"n": 0}
    def flaky_get(url, timeout):
        call_count["n"] += 1
        if call_count["n"] < 5:
            raise RuntimeError("simulated network error")
        resp = MagicMock(content=zip_bytes)
        resp.raise_for_status = MagicMock()
        return resp

    with patch.object(mod, "requests") as mock_req, \
         patch.object(mod, "time") as mock_time:
        mock_req.get = MagicMock(side_effect=flaky_get)
        mock_time.sleep = MagicMock()  # skip real backoff
        csv = mod.fetch_domain_csv("FS")
    assert b"Afghanistan" in csv
    assert call_count["n"] == 5


def test_fetch_domain_csv_gives_up_after_max_attempts():
    """If every attempt fails, raise a RuntimeError with the last
    error message. Downstream main() catches this and writes FAILED
    tracker rows."""
    mod, _, _, _ = _load_fetcher()
    with patch.object(mod, "requests") as mock_req, \
         patch.object(mod, "time") as mock_time:
        mock_req.get = MagicMock(side_effect=RuntimeError("permanent fail"))
        mock_time.sleep = MagicMock()
        with pytest.raises(RuntimeError, match="failed after"):
            mod.fetch_domain_csv("FS")
        # 5 attempts total (MAX_FETCH_ATTEMPTS default)
        assert mock_req.get.call_count == 5


# ---------------------------------------------------------------------- #
# main() end-to-end                                                      #
# ---------------------------------------------------------------------- #


def test_main_happy_path_writes_success_tracker_and_decrements_counter():
    """One indicator, CSV parses cleanly, Parquet writes, status=SUCCESS,
    counter decremented by 1."""
    mod, s3_client, counter_table, tracker_table = _load_fetcher()
    zip_bytes = _build_zip(_FAOSTAT_CSV_SAMPLE.encode("latin-1"))

    fake_response = MagicMock(content=zip_bytes)
    fake_response.raise_for_status = MagicMock()
    with patch.object(mod, "requests") as mock_req, \
         patch.object(mod, "time") as mock_time:
        mock_req.get = MagicMock(return_value=fake_response)
        mock_time.sleep = MagicMock()
        mock_time.time = MagicMock(return_value=1_750_000_000.0)
        rc = mod.main()
    assert rc == 0
    # SUCCESS tracker row written for FA-01
    put_calls = tracker_table.put_item.call_args_list
    assert len(put_calls) == 1
    item = put_calls[0].kwargs["Item"]
    assert item["indicator_id"] == "FA-01"
    assert item["status"] == "SUCCESS"
    assert item["provider"] == "FAOSTAT"
    # Counter decremented by 1 (one indicator in this batch)
    counter_table.update_item.assert_called_once()
    upd = counter_table.update_item.call_args.kwargs
    assert upd["ExpressionAttributeValues"][":neg"] == -1


def test_main_writes_failed_rows_when_download_fails():
    """If fetch_domain_csv fails after all retries, write a FAILED
    tracker row for EVERY indicator in the batch + decrement counter
    by the batch size. The Phase 1 checker must not hang."""
    mod, s3_client, counter_table, tracker_table = _load_fetcher()
    with patch.object(mod, "requests") as mock_req, \
         patch.object(mod, "time") as mock_time:
        mock_req.get = MagicMock(side_effect=RuntimeError("dns fail"))
        mock_time.sleep = MagicMock()
        mock_time.time = MagicMock(return_value=1_750_000_000.0)
        rc = mod.main()
    assert rc == 1
    # 1 FAILED tracker row (one indicator in this fixture batch)
    items = [c.kwargs["Item"] for c in tracker_table.put_item.call_args_list]
    assert len(items) == 1
    assert items[0]["status"] == "FAILED"
    assert items[0]["indicator_id"] == "FA-01"
    assert "dns fail" in items[0]["error"]
    # Counter still decremented (critical: otherwise the checker hangs)
    counter_table.update_item.assert_called_once()


def test_main_with_multiple_indicators_writes_one_row_per_indicator():
    """A domain task with 3 indicators should write 3 tracker rows and
    decrement the counter by 3 (one op, not three)."""
    indicators = [
        {"id_string": "FA-01", "numeric_id": 59, "item_code": 21010, "element_code": 6121},
        {"id_string": "FA-02", "numeric_id": 60, "item_code": 21010, "element_code": 99},  # no match → EMPTY
        {"id_string": "FA-03", "numeric_id": 61, "item_code": 21013, "element_code": 6128},
    ]
    with patch.dict(os.environ, {"INDICATORS_JSON": json.dumps(indicators)}):
        mod, _, counter_table, tracker_table = _load_fetcher()
        zip_bytes = _build_zip(_FAOSTAT_CSV_SAMPLE.encode("latin-1"))
        fake_response = MagicMock(content=zip_bytes)
        fake_response.raise_for_status = MagicMock()
        with patch.object(mod, "requests") as mock_req, \
             patch.object(mod, "time") as mock_time:
            mock_req.get = MagicMock(return_value=fake_response)
            mock_time.sleep = MagicMock()
            mock_time.time = MagicMock(return_value=1_750_000_000.0)
            rc = mod.main()
    assert rc == 0
    rows = [c.kwargs["Item"] for c in tracker_table.put_item.call_args_list]
    assert len(rows) == 3
    assert {r["indicator_id"] for r in rows} == {"FA-01", "FA-02", "FA-03"}
    # One counter decrement, by 3
    counter_table.update_item.assert_called_once()
    assert counter_table.update_item.call_args.kwargs[
        "ExpressionAttributeValues"
    ][":neg"] == -3
