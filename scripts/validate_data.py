"""Check the CSV files in data/ before they reach the site.

Run: python3 scripts/validate_data.py
Fails (exit 1) when a row has a missing column, a non-numeric value,
an unknown region, or a source_id that is not listed in sources.csv.
"""
import csv
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
REGIONS = {"HK", "TW", "MO"}
REQUIRED = {
    "sources.csv": ["source_id", "region", "type", "name", "url", "licence", "cadence", "accessed"],
    "suicide.csv": ["region", "year", "sex", "age_group", "measure", "value", "unit", "estimate", "source_id"],
    "services.csv": ["region", "period", "indicator", "group", "value", "unit", "source_id"],
    "surveys.csv": ["region", "year", "survey", "population", "sample", "indicator", "value", "unit", "source_id", "method"],
    "suicide_quarterly.csv": ["region", "year", "quarter", "deaths", "source_id"],
    "indicators.csv": ["indicator_id", "name_en", "name_zh", "construct", "unit", "count_type", "denominator", "comparability_note", "used_in"],
    "budget_lines.csv": ["region", "fiscal_year", "period_type", "indicator_id", "program", "category", "stage", "value", "currency", "original_unit", "scope", "included_in_total", "source_id", "source_locator", "verification"],
    "gaps.csv": ["region", "year", "indicator_id", "status", "missing_reason", "searched_sources", "next_action", "owner", "last_checked", "eligible_for_chart"],
}
STAGES = {"actual_expenditure", "revised_estimate", "legal_budget", "legal_budget_incl_supplementary", "proposed_budget", "approved_plan_total"}
GAP_STATUS = {"V", "L", "M"}
SOURCE_TYPES = {"government", "ngo", "academic", "news"}
NUMERIC = {"budget_lines.csv": ["value"], "suicide.csv": ["year", "value"], "services.csv": ["value"], "surveys.csv": ["sample", "value"], "suicide_quarterly.csv": ["year", "quarter", "deaths"]}


def read(name):
    with open(DATA / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    errors = []
    tables = {name: read(name) for name in REQUIRED}
    source_ids = {row["source_id"] for row in tables["sources.csv"]}
    used = set()
    for name, rows in tables.items():
        header = rows[0].keys() if rows else []
        for col in REQUIRED[name]:
            if col not in header:
                errors.append(f"{name}: missing column '{col}'")
        for i, row in enumerate(rows, start=2):
            where = f"{name} line {i}"
            for col in REQUIRED[name]:
                if not (row.get(col) or "").strip():
                    errors.append(f"{where}: empty '{col}'")
            if "region" in REQUIRED[name] and row.get("region") not in REGIONS:
                errors.append(f"{where}: unknown region '{row.get('region')}'")
            for col in NUMERIC.get(name, []):
                try:
                    float(row[col])
                except (TypeError, ValueError):
                    errors.append(f"{where}: '{col}' is not a number ({row.get(col)!r})")
            if name not in ("sources.csv", "indicators.csv", "gaps.csv") and "source_id" in row:
                used.add(row["source_id"])
                if row["source_id"] not in source_ids:
                    errors.append(f"{where}: source_id '{row['source_id']}' is not in sources.csv")
            if name == "sources.csv" and row.get("type") not in SOURCE_TYPES:
                errors.append(f"{where}: type must be one of {sorted(SOURCE_TYPES)}")
            if name == "suicide.csv" and row.get("estimate") not in {"yes", "no"}:
                errors.append(f"{where}: estimate must be yes or no")
    indicator_ids = {row["indicator_id"] for row in tables["indicators.csv"]}
    for i, row in enumerate(tables["budget_lines.csv"], start=2):
        if row["stage"] not in STAGES:
            errors.append(f"budget_lines.csv line {i}: unknown stage '{row['stage']}'")
        if row["indicator_id"] not in indicator_ids:
            errors.append(f"budget_lines.csv line {i}: indicator_id '{row['indicator_id']}' not in indicators.csv")
    # Each HK fiscal year: the components must add up to the published total.
    hk = {}
    for row in tables["budget_lines.csv"]:
        if row["region"] == "HK" and row["program"].startswith("Hospital Authority"):
            part = hk.setdefault(row["fiscal_year"], {"parts": 0, "total": None})
            if row["category"] == "total":
                part["total"] = int(row["value"])
            else:
                part["parts"] += int(row["value"])
    for year, part in hk.items():
        if part["total"] is None or part["parts"] != part["total"]:
            errors.append(f"budget_lines.csv: HK {year} components {part['parts']} do not equal total {part['total']}")
    for i, row in enumerate(tables["gaps.csv"], start=2):
        if row["status"] not in GAP_STATUS:
            errors.append(f"gaps.csv line {i}: status must be V, L or M")
        if row["eligible_for_chart"] != "no" and row["status"] != "V":
            errors.append(f"gaps.csv line {i}: only V items may be charted")
        if row["indicator_id"] not in indicator_ids:
            errors.append(f"gaps.csv line {i}: indicator_id '{row['indicator_id']}' not in indicators.csv")
    for sid in sorted(source_ids - used):
        print(f"note: source '{sid}' is listed but no figure uses it yet")
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    print(f"OK: {sum(len(r) for r in tables.values())} rows across {len(tables)} files")


if __name__ == "__main__":
    main()
