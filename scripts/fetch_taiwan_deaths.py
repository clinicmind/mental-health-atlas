"""Download Taiwan's cause-of-death open data and summarise suicide deaths by year.

Source: Ministry of Health and Welfare, "Cause of death statistics"
https://data.gov.tw/en/datasets/5965 (Open Government Data License 1.0)

Run on a machine with normal internet access:
    python3 scripts/fetch_taiwan_deaths.py <csv_url> [<csv_url> ...]
Copy the per-year CSV download links from the dataset page. The script
prints suicide deaths per year (ICD-10 X60-X84 and Y87.0 are grouped by
MOHW under the "suicide" cause code) so they can be checked and added to
data/suicide.csv by hand.
"""
import csv
import io
import sys
import urllib.request
from collections import Counter

# MOHW labels cause of death in Chinese; match on the suicide category name.
SUICIDE_MARKERS = ("蓄意自我傷害", "自殺")


def rows_from(url):
    with urllib.request.urlopen(url, timeout=60) as resp:
        raw = resp.read()
    for enc in ("utf-8-sig", "big5", "cp950"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    return list(csv.DictReader(io.StringIO(text)))


def main(urls):
    totals = Counter()
    for url in urls:
        rows = rows_from(url)
        if not rows:
            continue
        cols = rows[0].keys()
        cause_col = next(c for c in cols if "cause" in c.lower() or "死因" in c)
        year_col = next(c for c in cols if "year" in c.lower() or "年" in c)
        n_col = next(c for c in cols if c.strip().upper() == "N" or "人數" in c)
        for r in rows:
            if any(m in r[cause_col] for m in SUICIDE_MARKERS):
                totals[r[year_col]] += int(float(r[n_col] or 0))
    for year in sorted(totals):
        print(f"{year},{totals[year]}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
