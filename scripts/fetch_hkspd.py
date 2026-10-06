"""Summarise the Hong Kong Suicide Press Database (HKSPD) into monthly counts.

Source: https://hkspd.siuyeong.com/ (data: https://hkspd.siuyeong.com/csv)
Terms:  https://hkspd.siuyeong.com/使用及引用指引 (non-commercial use; cite as
        "資料來源：香港自殺報道資料庫（HKSPD）" with the URL and access date).

Run on a machine with normal internet access:
    python3 scripts/fetch_hkspd.py <csv_url_or_local_file> > data/hk_press_monthly.csv

Safe messaging: this script reads only the date, sex, age and outcome columns
and writes counts per month. It never copies method, location, name or reason
columns, so none of them can reach the site. Counts are media reports, not
official statistics, and must not be compared with the CSRP or Coroner series.
"""
import csv
import io
import sys
import urllib.request
from collections import Counter

BANDS = [(0, 14, "under 15"), (15, 24, "15-24"), (25, 59, "25-59"), (60, 200, "60+")]


def read(src):
    if src.startswith("http"):
        with urllib.request.urlopen(src, timeout=60) as r:
            raw = r.read()
    else:
        raw = open(src, "rb").read()
    return csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))


def band(age):
    try:
        a = int(age)
    except (TypeError, ValueError):
        return "unknown"
    return next((n for lo, hi, n in BANDS if lo <= a <= hi), "unknown")


def main(src):
    counts = Counter()
    for r in read(src):
        date = (r.get("caseDate") or r.get("newsDate") or "")[:7]
        if len(date) != 7:
            continue
        outcome = "died" if r.get("State") == "身亡" else "other"
        sex = {"男": "male", "女": "female"}.get(r.get("Gender"), "unknown")
        counts[(date, sex, band(r.get("Age")), outcome)] += 1
    w = csv.writer(sys.stdout, lineterminator="\n")
    w.writerow(["month", "sex", "age_group", "outcome", "reports"])
    for k in sorted(counts):
        w.writerow([*k, counts[k]])


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
