"""Print the sources in data/update_calendar.csv that are due this month."""
import csv, datetime, sys
from pathlib import Path

month = int(sys.argv[1]) if len(sys.argv) > 1 else datetime.date.today().month
rows = csv.DictReader(open(Path(__file__).resolve().parent.parent / "data" / "update_calendar.csv", encoding="utf-8"))
for r in rows:
    if r["month"] == "*" or month in {int(m) for m in r["month"].split(";")}:
        print(f"- [ ] {r['source']} ({r['region']}, {r['frequency']}): {r['what_to_update']}")
