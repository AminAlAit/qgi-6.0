"""
Phase 5: Recipe Engine — matches patterns against events to create recipes.

Implements D4 (event window = max(1, ceil(length * 0.15))) and D5 (both
countries must match the same event type). Supports optional cutoff_year
for backtesting walk-forward validation (D12/D13/D14).

Reads: qgi_data.patterns (Athena), qgi_data.events (Athena)
Writes: s3://{bucket}/recipes/ (Parquet)
"""

import os
import math
import uuid
import logging
import time
from collections import defaultdict
from io import BytesIO

import boto3
import pandas as pd
import awswrangler as wr

logger = logging.getLogger()
logger.setLevel(logging.INFO)

S3_BUCKET = os.environ.get('S3_BUCKET')
ATHENA_DB = os.environ.get('ATHENA_DATABASE', 'qgi_data')
ATHENA_WG = os.environ.get('ATHENA_WORKGROUP', 'QGI-Lambda-Workgroup')
S3_OUTPUT = os.environ.get('S3_OUTPUT_LOCATION', f's3://{S3_BUCKET}/query_results/')
RECIPES_PREFIX = 'recipes/'


def lambda_handler(event, context):
    run_id = event.get('run_id', 'manual')
    cutoff_year = event.get('cutoff_year')  # Optional: for backtesting

    logger.info(f"Recipe Engine starting. run_id={run_id}, cutoff_year={cutoff_year}")

    # 1. Load patterns from Athena
    patterns_df = load_patterns(cutoff_year)
    if patterns_df.empty:
        logger.info("No patterns found. Exiting.")
        return {'statusCode': 200, 'recipes_count': 0}

    # 2. Load events from Athena
    events_df = load_events(cutoff_year)
    if events_df.empty:
        logger.info("No events found. Exiting.")
        return {'statusCode': 200, 'recipes_count': 0}

    # 3. Load country ID -> name mapping
    country_names = load_country_names()

    # 4. Build event index: (country_id, category_normalized) -> [(year, title)]
    event_index = build_event_index(events_df)

    # 5. Generate recipes
    recipes = generate_recipes(patterns_df, event_index, country_names)
    logger.info(f"Generated {len(recipes)} recipe rows.")

    if not recipes:
        return {'statusCode': 200, 'recipes_count': 0}

    # 6. Write to S3
    recipes_df = pd.DataFrame(recipes)
    write_recipes(recipes_df)

    return {
        'statusCode': 200,
        'recipes_count': len(recipes),
        'unique_categories': int(recipes_df['event_category'].nunique()),
        'unique_patterns': int(recipes_df['pattern_id'].nunique()),
    }


def load_patterns(cutoff_year=None):
    """Load patterns from Athena. Optionally filter by cutoff year."""
    query = f"SELECT * FROM {ATHENA_DB}.patterns"
    if cutoff_year:
        # D12: filter patterns where both segments end before cutoff
        query += f" WHERE (start_year_a + length) <= {cutoff_year} AND (start_year_b + length) <= {cutoff_year}"

    logger.info(f"Loading patterns: {query[:100]}...")
    t0 = time.time()
    df = wr.athena.read_sql_query(
        sql=query,
        database=ATHENA_DB,
        workgroup=ATHENA_WG,
        ctas_approach=False,
    )
    logger.info(f"Loaded {len(df)} patterns in {time.time()-t0:.1f}s")
    return df


def load_events(cutoff_year=None):
    """Load events from Athena. Optionally filter by cutoff year."""
    query = f"SELECT country_id, country_name, year, title, category_normalized FROM {ATHENA_DB}.events"
    if cutoff_year:
        query += f" WHERE year <= {cutoff_year}"

    logger.info(f"Loading events: {query[:100]}...")
    t0 = time.time()
    df = wr.athena.read_sql_query(
        sql=query,
        database=ATHENA_DB,
        workgroup=ATHENA_WG,
        ctas_approach=False,
    )
    logger.info(f"Loaded {len(df)} events in {time.time()-t0:.1f}s")
    return df


def load_country_names():
    """Load country ID -> name mapping."""
    query = f"SELECT id, name_1 FROM {ATHENA_DB}.countries"
    df = wr.athena.read_sql_query(
        sql=query,
        database=ATHENA_DB,
        workgroup=ATHENA_WG,
        ctas_approach=False,
    )
    return {int(row['id']): row['name_1'] for _, row in df.iterrows()}


def build_event_index(events_df):
    """Build lookup: (country_id, category) -> [(year, title)]."""
    index = defaultdict(list)
    for _, row in events_df.iterrows():
        key = (int(row['country_id']), str(row['category_normalized']))
        index[key].append((int(row['year']), str(row.get('title', ''))))
    logger.info(f"Event index: {len(index)} (country, category) pairs")
    return index


def generate_recipes(patterns_df, event_index, country_names):
    """Core recipe matching: D4 window + D5 bilateral matching."""
    recipes = []

    # Pre-compute instance counts per category (for health field)
    category_counts = defaultdict(int)

    for _, pattern in patterns_df.iterrows():
        country_a_id = int(pattern['country_a_id'])
        country_b_id = int(pattern['country_b_id'])
        length = int(pattern['length'])
        start_year_a = int(pattern['start_year_a'])
        start_year_b = int(pattern['start_year_b'])

        # Compute end years and event window (D4)
        end_year_a = start_year_a + length
        end_year_b = start_year_b + length
        window = max(1, math.ceil(length * 0.15))

        # Find events for country A in window
        events_a_by_cat = defaultdict(list)
        for (cid, cat), year_titles in event_index.items():
            if cid != country_a_id:
                continue
            for yr, title in year_titles:
                if end_year_a - window <= yr <= end_year_a + window:
                    events_a_by_cat[cat].append((yr, title))

        # Find events for country B in window
        events_b_by_cat = defaultdict(list)
        for (cid, cat), year_titles in event_index.items():
            if cid != country_b_id:
                continue
            for yr, title in year_titles:
                if end_year_b - window <= yr <= end_year_b + window:
                    events_b_by_cat[cat].append((yr, title))

        # D5: Find categories present in BOTH
        matching_categories = set(events_a_by_cat.keys()) & set(events_b_by_cat.keys())

        for cat in matching_categories:
            # Take first matching event from each country
            ev_a = events_a_by_cat[cat][0]
            ev_b = events_b_by_cat[cat][0]

            category_counts[cat] += 1

            recipes.append({
                'recipe_id': str(uuid.uuid4())[:12],
                'event_category': cat,
                'pattern_id': str(pattern.get('pattern_id', '')),
                'country_a_id': country_a_id,
                'country_b_id': country_b_id,
                'country_a_name': country_names.get(country_a_id, f'ID_{country_a_id}'),
                'country_b_name': country_names.get(country_b_id, f'ID_{country_b_id}'),
                'start_year_a': start_year_a,
                'start_year_b': start_year_b,
                'length': length,
                'avg_correlation': float(pattern.get('avg_correlation', 0)),
                'end_year_a': end_year_a,
                'end_year_b': end_year_b,
                'event_window': window,
                'event_year_a': ev_a[0],
                'event_year_b': ev_b[0],
                'event_title_a': ev_a[1][:200],
                'event_title_b': ev_b[1][:200],
                'indicator_count': int(pattern.get('indicator_count', 1)),
                'pattern_power_score': float(pattern.get('pattern_power_score', 0)),
                'instance_count': 0,  # placeholder, filled below
            })

    # Fill instance counts
    for recipe in recipes:
        recipe['instance_count'] = category_counts[recipe['event_category']]

    return recipes


def write_recipes(df):
    """Write recipes DataFrame to S3 as Parquet."""
    s3_path = f"s3://{S3_BUCKET}/{RECIPES_PREFIX}"
    logger.info(f"Writing {len(df)} recipes to {s3_path}")

    wr.s3.to_parquet(
        df=df,
        path=s3_path,
        dataset=True,
        mode='overwrite',
    )
    logger.info("Recipes written successfully.")
