# Three Harbours Mental Health Atlas 港澳台心理健康數據

A chart-led, bilingual (繁體中文 / English) data site on mental health in Hong Kong, Taiwan and Macau: suicide, service use and population surveys, drawn from government, NGO and academic sources. Built for the public and for policymakers.

Every figure on the site links to its source. Figures that were calculated rather than published (for example a rate worked out from a death count and population) are marked as estimates.

## What is here

| Path | What it holds |
| --- | --- |
| `index.html`, `assets/` | The site. Plain HTML, CSS and JavaScript with no build step. |
| `data/suicide.csv` | Suicide deaths, rates and attempt reports by place, year, sex and age group |
| `data/suicide_quarterly.csv` | Macau suicide deaths per quarter from Health Bureau releases |
| `data/services.csv` | Service use: psychiatric caseload, waiting times, beds, hotline calls. `highlight=yes` rows appear on the overview. |
| `data/surveys.csv` | Survey results (prevalence and symptom screening) |
| `data/sources.csv` | Every source: type (government, NGO, academic, news), name, link, licence, update frequency, publication date, date accessed |
| `scripts/validate_data.py` | Checks the CSV files; runs automatically on every push |
| `scripts/fetch_taiwan_deaths.py` | Summarises Taiwan's open cause-of-death data into suicide deaths per year |

## Preview locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from disk will not load the data, because browsers block reading local files.

## Adding or correcting a figure

1. Add the source to `data/sources.csv` if it is new (one row, with a short `source_id`).
2. Add the figure to the right CSV with that `source_id`. Use `estimate=yes` in `suicide.csv` when you calculated the number yourself, and explain how in `note`. Put the Chinese version of any note in `note_zh` (and of a source's name in `name_zh`); the site shows it when the page is in 繁中.
3. Run `python3 scripts/validate_data.py`.
4. Commit. The same check runs on GitHub.

## Data notes

- News reports are used for figures that officials announce but do not publish as data (for example Macau's yearly suicide totals). They are marked `news` in `sources.csv` and listed on the Sources page.

- Sources sometimes disagree (Macau Business put 2024 at 86 while the Health Bureau's quarterly releases add up to 90). The CSV records the one used and mentions the other in `note`.
- Survey results from different studies measure different things (diagnostic interviews vs symptom screening) and are not comparable across places.
- WHO datasets usually omit Taiwan and fold Hong Kong and Macau into China, so they are not used for comparisons here.
- Suicide content follows safe-messaging guidance: no methods or locations, and help lines on every page.

## Help lines

Hong Kong 18111 · Samaritan Befrienders 2389 2222 · Taiwan 1925 · Macau Caritas Life Hope Hotline 2852 5222

## HKSPD news-report counts

`scripts/fetch_hkspd.py` turns the Hong Kong Suicide Press Database CSV into monthly counts by sex, age band and outcome (`data/hk_press_monthly.csv`). It never reads method, location, name or reason columns. The cloud sandbox cannot reach the database, so run it on a machine with internet access, then save the output as `data/hk_press_monthly.csv`. The Suicide page draws a monthly chart automatically when that file exists, and hides it when it doesn't. To refresh monthly, re-run the command and commit the file. These are media-report counts, not official statistics; follow the usage and citation terms shown on the site's Sources page.

## Monthly update routine

`data/update_calendar.csv` lists which sources to check in which month. A GitHub Action (`.github/workflows/monthly-reminder.yml`) opens an issue on the 1st of each month with that month's checklist; you can also run it by hand from the Actions tab, or print the list with `python3 scripts/update_reminder.py`.

Every chart shows "data up to" and a CSV download button. Both are built from the data files, so they update when you do.

## Data model (stage A, 2026-10-09)

- `indicators.csv`: one row per indicator the site uses. Records the construct, unit, count type, denominator and comparability note.
- `budget_lines.csv`: budget lines with their stage (actual expenditure, revised estimate, legal budget, proposed budget, approved plan total). Only values marked verified in the review spec are imported. HK components must sum to the total; the validator checks this.
- `gaps.csv`: every year and region not yet verified (status V, L or M), with the reason, the sources searched and the next action. Only V items may be charted (`eligible_for_chart` must be `no` for L and M).
- The existing CSVs (`suicide.csv`, `services.csv`, and so on) are unchanged in shape. They will be mapped to observations in a later stage.
