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
2. Add the figure to the right CSV with that `source_id`. Use `estimate=yes` in `suicide.csv` when you calculated the number yourself, and explain how in `note`.
3. Run `python3 scripts/validate_data.py`.
4. Commit. The same check runs on GitHub.

## Data notes

- News reports are used for figures that officials announce but do not publish as data (for example Macau's yearly suicide totals). They are marked `news` in `sources.csv` and listed on the Sources page.

- Sources sometimes disagree (Macau 2024 is reported as both 90 and 91 suicide deaths). The CSV records the one used and mentions the other in `note`.
- Survey results from different studies measure different things (diagnostic interviews vs symptom screening) and are not comparable across places.
- WHO datasets usually omit Taiwan and fold Hong Kong and Macau into China, so they are not used for comparisons here.
- Suicide content follows safe-messaging guidance: no methods or locations, and help lines on every page.

## Help lines

Hong Kong 18111 · Samaritan Befrienders 2389 2222 · Taiwan 1925 · Macau Caritas Life Hope Hotline 2852 5222
