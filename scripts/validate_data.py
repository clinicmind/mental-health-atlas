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
}
SOURCE_TYPES = {"government", "ngo", "academic", "news"}
NUMERIC = {"suicide.csv": ["year", "value"], "services.csv": ["value"], "surveys.csv": ["sample", "value"], "suicide_quarterly.csv": ["year", "quarter", "deaths"]}


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
            if row.get("region") not in REGIONS:
                errors.append(f"{where}: unknown region '{row.get('region')}'")
            for col in NUMERIC.get(name, []):
                try:
                    float(row[col])
                except (TypeError, ValueError):
                    errors.append(f"{where}: '{col}' is not a number ({row.get(col)!r})")
            if name != "sources.csv":
                used.add(row["source_id"])
                if row["source_id"] not in source_ids:
                    errors.append(f"{where}: source_id '{row['source_id']}' is not in sources.csv")
            if name == "sources.csv" and row.get("type") not in SOURCE_TYPES:
                errors.append(f"{where}: type must be one of {sorted(SOURCE_TYPES)}")
            if name == "suicide.csv" and row.get("estimate") not in {"yes", "no"}:
                errors.append(f"{where}: estimate must be yes or no")
    for sid in sorted(source_ids - used):
        print(f"note: source '{sid}' is listed but no figure uses it yet")
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    print(f"OK: {sum(len(r) for r in tables.values())} rows across {len(tables)} files")


if __name__ == "__main__":
    main()
