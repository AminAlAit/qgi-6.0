"""
Auto-remap pass: rewrites curated/*.json files in-place, mapping non-canonical
category strings onto the canonical 71 Layer-3 codes from
taxonomy_hierarchy.json.

Backups go to curated/_backup_pre_remap/ before any write.

Coverage target: ALL 327 invalid categories observed in the 2026-04-16 audit.
Anything not in REMAP is left as-is and reported as STILL INVALID at the end.

Usage:
  python _remap_categories.py --apply        # writes changes
  python _remap_categories.py                # dry run (default)
"""
import argparse
import json
import shutil
import sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).parent
TAX = ROOT / "taxonomy_hierarchy.json"
CURATED = ROOT / "curated"
BACKUP_DIR = CURATED / "_backup_pre_remap"

with open(TAX, "r", encoding="utf-8") as f:
    tax = json.load(f)

CANONICAL = set()
for l1 in tax["layer1"]:
    for l2 in l1["layer2"]:
        for l3 in l2["layer3"]:
            CANONICAL.add(l3)

# ---------------------------------------------------------------------------
# REMAP dict — covers all 327 observed invalid categories.
# Mappings chosen by best-fit semantics. When a label is ambiguous (e.g.
# "diplomacy" could be bilateral or multilateral), we pick the more conservative
# default and rely on the salience module's max-aggregation to do the right
# thing at L1.
# ---------------------------------------------------------------------------
REMAP = {
    # --- big buckets (top 20 by frequency) ---
    "terrorism_and_extremism": "terrorist_attack",
    "social_movements_and_protest": "mass_protest",
    "insurgency_and_guerrilla": "civil_war_and_insurgency",
    "energy_policy_and_resources": "energy_policy",
    "diplomatic_relations": "bilateral_treaty",
    "human_rights": "human_rights_violation",
    "cold_war_geopolitics": "bilateral_treaty",
    "trade_and_commerce": "trade_agreement",
    "public_health_and_epidemics": "epidemic_and_pandemic",
    "infrastructure_and_urban_development": "infrastructure_project",
    "technology_and_digital": "technology_breakthrough",
    "coup_and_political_takeover": "military_coup",
    "decolonization_and_independence": "democratic_transition",
    "international_sanctions": "sanctions_and_arms_embargo",
    "executive_transition": "government_formation",
    "privatization_and_nationalization": "economic_liberalization",
    "communist_regime_and_transition": "democratic_transition",
    "international_alliances": "multilateral_agreement",
    "labor_and_industrial_relations": "labor_action",
    "land_reform_and_agrarian": "agricultural_policy",

    # --- mid-frequency (10-50 events) ---
    "foreign_investment_and_aid": "foreign_aid_and_development",
    "religion_and_society": "religious_and_social_movement",
    "protest_and_civil_unrest": "mass_protest",
    "gender_and_womens_rights": "human_rights_reform",
    "Politics": "government_formation",
    "genocide_and_mass_atrocity": "human_rights_violation",
    "sport_and_international_events": "sport_and_international_event",
    "Political Transition": "democratic_transition",
    "education_and_intellectual_life": "education_and_research",
    "military_conflict": "interstate_war",
    "media_and_press_freedom": "political_repression",
    "GOVERNANCE": "government_formation",
    "social_welfare_and_poverty": "poverty_and_inequality_crisis",
    "economic_crisis": "economic_recession",
    "civil_liberties": "human_rights_reform",
    "political_transition": "democratic_transition",
    "Diplomacy": "bilateral_treaty",
    "trade_policy": "trade_agreement",
    "national_identity_and_culture": "cultural_and_heritage",
    "gang_violence_and_crime": "ethnic_and_communal_conflict",
    "mining_and_extractive_industry": "resource_conflict",
    "economic_growth": "economic_growth_milestone",
    "judicial_reform": "human_rights_reform",
    "Natural Disaster": "natural_disaster",
    "Political Stability & Governance": "government_formation",
    "Elections": "elections_and_voting",
    "demographics_and_population": "migration_and_refugees",
    "political_repression_and_persecution": "political_repression",
    "Economy": "economic_recession",
    "race_and_ethnic_relations": "ethnic_and_communal_conflict",
    "postwar_reconstruction": "peacekeeping_and_peace_process",
    "monetary_policy": "monetary_policy_change",
    "security_sector_reform": "military_policy_and_reform",
    "ENERGY_ENVIRONMENT": "energy_policy",
    "Economic Crisis": "economic_recession",
    "Military & Defense": "military_policy_and_reform",
    "indigenous_rights": "human_rights_reform",

    # --- low-frequency (3-10 events) ---
    "Economic Reform": "economic_liberalization",
    "elections_and_political_competition": "elections_and_voting",
    "ECONOMY": "economic_recession",
    "Economic Policy": "fiscal_policy_change",
    "elections": "elections_and_voting",
    "elections_and_political_transitions": "elections_and_voting",
    "climate_change_and_adaptation": "climate_agreement",
    "Foreign Intervention": "foreign_intervention",
    "International Relations": "bilateral_treaty",
    "Conflict": "civil_war_and_insurgency",
    "international_law": "multilateral_agreement",
    "Social Movement": "religious_and_social_movement",
    "SOCIAL": "mass_protest",
    "Foreign Policy": "bilateral_treaty",
    "Human Rights & Atrocities": "human_rights_violation",
    "military_alliances_and_coalitions": "multilateral_agreement",
    "deforestation_and_land_use": "environmental_policy",
    "Territorial Dispute": "territorial_disputes",
    "government_crisis": "government_formation",
    "labor_movements_and_trade_unions": "labor_action",
    "Political Repression": "political_repression",
    "International": "bilateral_treaty",
    "Social": "mass_protest",
    "Authoritarianism & Repression": "executive_power_consolidation",
    "armed_conflict_and_civil_war": "civil_war_and_insurgency",
    "territorial_dispute": "territorial_disputes",
    "peace_negotiation": "peacekeeping_and_peace_process",
    "social_unrest": "mass_protest",
    "arts_culture_and_heritage": "cultural_and_heritage",
    "leadership_transition": "government_formation",
    "DIPLOMACY": "bilateral_treaty",
    "Military Alliance": "multilateral_agreement",
    "Political Violence": "political_violence",
    "Electoral Politics": "elections_and_voting",
    "Constitutional Crisis": "constitutional_change",
    "Military Coup": "military_coup",
    "State Repression": "political_repression",
    "Public Health Crisis": "epidemic_and_pandemic",
    "Elections and Democracy": "elections_and_voting",
    "Natural Resources": "resource_conflict",
    "Geopolitics & Foreign Policy": "bilateral_treaty",
    "Natural Disasters & Crisis Response": "natural_disaster",
    "ethnic_religious_violence": "ethnic_and_communal_conflict",
    "Military Conflict": "interstate_war",
    "Regional Integration": "regional_integration",
    "Financial Crisis": "banking_and_financial_crisis",
    "Monetary Policy": "monetary_policy_change",
    "Social Policy & Welfare": "social_policy_reform",
    "elections_and_referendums": "elections_and_voting",
    "regime_change": "democratic_transition",
    "Elections & Political Transitions": "elections_and_voting",
    "Corruption Scandal": "political_corruption",
    "religion_and_state": "religious_and_social_movement",
    "governance_and_political_transitions": "democratic_transition",
    "foreign_policy_and_diplomacy": "bilateral_treaty",
    "Political Unrest": "mass_protest",
    "political_assassinations": "political_violence",
    "economic_policy_change": "fiscal_policy_change",

    # --- 1-3 event tail ---
    "infrastructure_development": "infrastructure_project",
    "HEALTH_DISASTER": "epidemic_and_pandemic",
    "CONFLICT": "civil_war_and_insurgency",
    "Armed Conflict": "civil_war_and_insurgency",
    "Economic Growth": "economic_growth_milestone",
    "Constitutional Change": "constitutional_change",
    "Transitional Justice": "transitional_justice",
    "Terrorism": "terrorist_attack",
    "Forced Migration": "migration_and_refugees",
    "Science & Technology": "technology_breakthrough",
    "international_relations": "bilateral_treaty",
    "foreign_policy": "bilateral_treaty",
    "coup": "military_coup",
    "constitution": "constitutional_change",
    "political_crisis": "government_formation",
    "Political Stability & Succession": "government_formation",
    "Political Violence & Terrorism": "terrorist_attack",
    "Economic Development": "economic_growth_milestone",
    "Resource Conflict": "resource_conflict",
    "human_rights_and_civil_liberties": "human_rights_reform",
    "Government Change": "government_formation",
    "Rule of Law": "human_rights_reform",
    "state_consolidation": "executive_power_consolidation",
    "resource_nationalization": "economic_nationalization",
    "terrorism_and_political_violence": "terrorist_attack",
    "coup_or_takeover": "military_coup",
    "Public Health": "epidemic_and_pandemic",
    "public_health_crisis": "epidemic_and_pandemic",
    "arms_control": "multilateral_agreement",
    "TRADE": "trade_agreement",
    "Civil Rights": "human_rights_reform",
    "Peace Agreement": "peacekeeping_and_peace_process",
    "Authoritarian Governance": "executive_power_consolidation",
    "Political Instability": "government_formation",
    "Economic Recovery": "economic_recovery",
    "Authoritarian Consolidation": "executive_power_consolidation",
    "Mass Protests": "mass_protest",
    "Environmental Crisis": "environmental_policy",
    "Infrastructure & Development": "infrastructure_project",
    "Political Scandal": "political_corruption",
    "Human Rights & Civil Liberties": "human_rights_reform",
    "Demographic Change": "migration_and_refugees",
    "Environmental Policy": "environmental_policy",
    "Civil Society & Human Rights": "human_rights_reform",
    "Energy": "energy_policy",
    "labor_and_employment": "labor_action",
    "economic_reform": "economic_liberalization",
    "foreign_investment": "foreign_direct_investment",
    "debt_and_financial_crisis": "banking_and_financial_crisis",
    "interstate_relations": "bilateral_treaty",
    "economic_sanctions": "sanctions_and_arms_embargo",
    "political_party": "government_formation",
    "armed_conflict": "civil_war_and_insurgency",
    "peace_process": "peacekeeping_and_peace_process",
    "Agriculture & Food Security": "agricultural_policy",
    "Political Movements & Opposition": "mass_protest",
    "Religion & Sectarianism": "religious_and_social_movement",
    "Corruption & Scandal": "political_corruption",
    "Peace Processes & Diplomacy": "peacekeeping_and_peace_process",
    "Economic Policy & Reform": "economic_liberalization",
    "Rule of Law & Judiciary": "human_rights_reform",
    "Civil Liberties & Freedoms": "human_rights_reform",
    "Political Reform": "constitutional_change",
    "Mass Protest": "mass_protest",
    "Land Reform": "agricultural_policy",
    "Resource Nationalization": "economic_nationalization",
    "Armed Group Formation": "civil_war_and_insurgency",
    "Democratic Backsliding": "executive_power_consolidation",
    "Counter-terrorism": "terrorist_attack",
    "land_reform_and_rural_policy": "agricultural_policy",
    "media_freedom_and_censorship": "political_repression",
    "gender_equality_and_womens_rights": "human_rights_reform",
    "migration_and_refugee_crises": "migration_and_refugees",
    "Human Rights": "human_rights_violation",
    "Sport": "sport_and_international_event",
    "European Integration": "regional_integration",
    "labor_strikes_and_protests": "labor_action",
    "peace_negotiations_and_agreements": "peacekeeping_and_peace_process",
    "forced_displacement_and_refugee_crises": "migration_and_refugees",
    "democratic_backsliding": "executive_power_consolidation",
    "foreign_debt_and_financial_crises": "banking_and_financial_crisis",
    "environmental_disaster": "natural_disaster",
    "sanctions_and_international_pressure": "sanctions_and_arms_embargo",

    # --- 1-event tail ---
    "Civil Conflict": "civil_war_and_insurgency",
    "Sovereignty Dispute": "territorial_disputes",
    "Ethnic Violence": "ethnic_and_communal_conflict",
    "Political Exile": "political_repression",
    "Military Intervention": "foreign_intervention",
    "Democratization": "democratic_transition",
    "Political Party Formation": "government_formation",
    "Healthcare Reform": "public_health_reform",
    "Development Aid": "foreign_aid_and_development",
    "Political Corruption": "political_corruption",
    "Regional Instability": "civil_war_and_insurgency",
    "Economic Sanctions": "sanctions_and_arms_embargo",
    "International Recognition": "bilateral_treaty",
    "Diplomatic Relations": "bilateral_treaty",
    "Monetary Union": "regional_integration",
    "Counter-Terrorism": "terrorist_attack",
    "International Prestige": "sport_and_international_event",
    "Sports Achievement": "sport_and_international_event",
    "Social Unrest": "mass_protest",
    "Fiscal Crisis": "fiscal_policy_change",
    "Sovereign Debt Crisis": "economic_recession",
    "Debt Restructuring": "fiscal_policy_change",
    "Far-Right Politics": "executive_power_consolidation",
    "Refugee Crisis": "migration_and_refugees",
    "Climate Disaster": "natural_disaster",
    "Infrastructure Failure": "infrastructure_project",
    "State-Sponsored Violence": "political_repression",
    "Church-State Conflict": "religious_and_social_movement",
    "Emigration and Diaspora": "migration_and_refugees",
    "Church-State Relations": "religious_and_social_movement",
    "Leadership Transition": "government_formation",
    "Media Freedom": "political_repression",
    "Corruption and Repression": "political_corruption",
    "Agricultural Crisis": "drought_and_famine",
    "Religious and Social Mobilization": "religious_and_social_movement",
    "Public Health and Stigma": "public_health_reform",
    "End of Dictatorship": "democratic_transition",
    "Constitutional Politics": "constitutional_change",
    "International Diplomacy": "bilateral_treaty",
    "Foreign Military Intervention": "foreign_intervention",
    "Electoral Dispute": "elections_and_voting",
    "Targeted Killing": "political_violence",
    "Authoritarian Backsliding": "executive_power_consolidation",
    "Forced Exile and Political Collapse": "political_repression",
    "UN Peacekeeping": "peacekeeping_and_peace_process",
    "Food Security Crisis": "drought_and_famine",
    "Public Health Emergency": "epidemic_and_pandemic",
    "International Aid Failure": "foreign_aid_and_development",
    "Electoral Crisis": "elections_and_voting",
    "UN Mission Closure": "peacekeeping_and_peace_process",
    "Anti-Corruption Protests": "mass_protest",
    "State Failure and Gang Violence": "ethnic_and_communal_conflict",
    "Political Assassination": "political_violence",
    "Gang Control and Economic Paralysis": "ethnic_and_communal_conflict",
    "International Security Response": "foreign_intervention",
    "State Collapse and Political Transition": "democratic_transition",
    "International Security Mission": "peacekeeping_and_peace_process",
    "Governance & Institutions": "government_formation",
    "Civil Unrest": "mass_protest",
    "Economic Boom": "economic_growth_milestone",
    "Geopolitics": "bilateral_treaty",
    "Energy Policy": "energy_policy",
    "Territorial Disputes": "territorial_disputes",
    "Immigration & Refugee Policy": "migration_and_refugees",
    "Agricultural Policy": "agricultural_policy",
    "Foreign Direct Investment": "foreign_direct_investment",
    "Financial Sector": "banking_and_financial_crisis",
    "Labor & Employment": "labor_action",
    "human_rights_and_governance": "human_rights_reform",
    "famine_and_food_crisis": "drought_and_famine",
    "media_freedom": "political_repression",
    "corruption_and_scandal": "political_corruption",
    "military_intervention": "foreign_intervention",
    "science_technology": "technology_breakthrough",
    "multilateral_diplomacy": "multilateral_agreement",
    "economic_planning": "fiscal_policy_change",
    "land_reform": "agricultural_policy",
    "environment_conservation": "environmental_policy",
    "political_opposition": "political_repression",
    "state_repression": "political_repression",
    "peace_agreement": "peacekeeping_and_peace_process",
    "ethnic_conflict": "ethnic_and_communal_conflict",
    "disarmament": "peacekeeping_and_peace_process",
    "epidemic": "epidemic_and_pandemic",
    "energy": "energy_policy",
    "Revolutions & Regime Change": "democratic_transition",
    "Education & Human Capital": "education_reform",
    "Civil War & Insurgency": "civil_war_and_insurgency",
    "International Law & Justice": "multilateral_agreement",
    "Disarmament & Post-Conflict": "peacekeeping_and_peace_process",
    "Civil Unrest & Protests": "mass_protest",
    "Sanctions & International Pressure": "sanctions_and_arms_embargo",
    "Public Health & Epidemics": "epidemic_and_pandemic",
    "Migration & Displacement": "migration_and_refugees",
    "Interstate Conflict": "interstate_war",
    "Impunity": "human_rights_violation",
    "Organized Crime": "ethnic_and_communal_conflict",
    "civil_society_and_ngos": "religious_and_social_movement",
    "ethnic_and_communal_violence": "ethnic_and_communal_conflict",
    "transitional_justice_and_reconciliation": "transitional_justice",
    "regional_integration_and_trade_blocs": "regional_integration",
    "economic_crises_and_recovery": "economic_recession",
    "political_crises_and_instability": "government_formation",
    "rule_of_law_and_judicial_independence": "human_rights_reform",
    "energy_security_and_policy": "energy_policy",
    "Social Policy": "social_policy_reform",
    "Authoritarianism": "executive_power_consolidation",
    "Labor": "labor_action",
    "Intelligence": "political_repression",
    "Revolution": "democratic_transition",
    "Environmental Disaster": "natural_disaster",
    "Security": "military_policy_and_reform",
    "trade_and_economic_agreements": "trade_agreement",
    "social_inequality_and_discrimination": "poverty_and_inequality_crisis",
    "security_and_counterterrorism": "terrorist_attack",
    "foreign_military_intervention": "foreign_intervention",
    "natural_disasters": "natural_disaster",
    "rule_of_law_and_judicial": "human_rights_reform",
    "agricultural_and_food_security": "agricultural_policy",
    "popular_uprisings_and_revolutions": "mass_protest",
    "imf_world_bank_interventions": "foreign_aid_and_development",
    "cultural_promotion": "cultural_and_heritage",
    "labor_and_social_policy": "social_policy_reform",
    "health_sector_initiative": "public_health_reform",
    "financial_crisis": "banking_and_financial_crisis",
    "labor_and_strikes": "labor_action",
    "media_and_censorship": "political_repression",
    "infrastructure_failure": "infrastructure_project",
    "social_policy": "social_policy_reform",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually write changes (default is dry run)")
    args = parser.parse_args()

    # Validate every REMAP target is canonical
    bad_targets = [(k, v) for k, v in REMAP.items() if v not in CANONICAL]
    if bad_targets:
        print("ERROR: REMAP has non-canonical targets:")
        for k, v in bad_targets:
            print(f"  {k!r} -> {v!r}")
        sys.exit(1)

    files = sorted(CURATED.glob("*.json"))
    print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}")
    print(f"Files to scan: {len(files)}")
    print(f"REMAP entries: {len(REMAP)}")
    print()

    if args.apply and not BACKUP_DIR.exists():
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        print(f"Created backup dir: {BACKUP_DIR}")

    total_remapped = 0
    total_still_invalid = 0
    still_invalid_counter: Counter[str] = Counter()
    files_changed = 0

    for path in files:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"  SKIP {path.name}: {e}")
            continue

        if isinstance(data, list):
            events = data
            wrapper = None
        elif isinstance(data, dict):
            wrapper = data
            events = data.get("events") or data.get("data") or []
            # Determine which key the events live in
            event_key = "events" if "events" in data else ("data" if "data" in data else None)
            if event_key is None:
                # No events array
                continue
        else:
            continue

        if not isinstance(events, list):
            continue

        file_remapped = 0
        file_still_invalid = 0
        for ev in events:
            if not isinstance(ev, dict):
                continue
            cat = ev.get("category") or ev.get("type")
            if not cat:
                continue
            if cat in CANONICAL:
                continue
            if cat in REMAP:
                ev["category"] = REMAP[cat]
                if "type" in ev and ev["type"] == cat:
                    ev["type"] = REMAP[cat]
                file_remapped += 1
            else:
                file_still_invalid += 1
                still_invalid_counter[cat] += 1

        if file_remapped > 0:
            files_changed += 1
            total_remapped += file_remapped
            if args.apply:
                # Backup
                backup_path = BACKUP_DIR / path.name
                shutil.copy2(path, backup_path)
                # Write
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

        total_still_invalid += file_still_invalid

    print(f"Files changed: {files_changed}")
    print(f"Events remapped: {total_remapped}")
    print(f"Events still invalid (not in REMAP): {total_still_invalid}")
    print()
    if still_invalid_counter:
        print("=== STILL INVALID categories (not in REMAP) ===")
        for cat, n in still_invalid_counter.most_common():
            print(f"  {n:5d}  {cat}")
    else:
        print("All invalid categories were remapped.")


if __name__ == "__main__":
    main()
