"""Print this month's data-update checklist as Markdown, from data/update_calendar.csv.

    python3 scripts/update_reminder.py [month_number]

With no argument it uses the current month. Used by the monthly GitHub Action.
"""
import csv
import datetime
import pathlib
import sys

CAL = pathlib.Path(__file__).resolve().parent.parent / "data" / "update_calendar.csv"


def main(month):
    due = [r for r in csv.DictReader(CAL.open(encoding="utf-8")) if str(month) in r["months"].split(";")]
    print(f"Sources due for a check in month {month}. Tick each one when the CSV is updated, or note that nothing new was published.\n")
    for r in due:
        target = f" (`data/{r['data_file']}`)" if r["data_file"] else ""
        print(f"- [ ] **{r['region']}**: {r['what']}{target}, look at {r['where_to_look']}")
    print("\nAfter updating: run `python3 scripts/validate_data.py`, then commit and push.")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else datetime.date.today().month)
