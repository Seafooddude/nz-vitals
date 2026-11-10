# NZ Vitals (draft)

A one-page, minimalist dashboard of New Zealand economic indicators.

## Structure

```
index.html            dashboard page
about.html            methodology and indicator notes
indicator.html        detail page for one indicator (?id=...)
briefing.html         one-page printable briefing of every connected indicator (Print / save as PDF)
region.html           detail page for one region (?r=...)
css/style.css         all styling (Helvetica, white / black / Knicks blue), including the sticky header
js/app.js             renders cards + SVG charts from data/data.json
js/menu.js            hamburger menu for the header on phones
data/data.json        the main data file the site reads
data/releases.json    upcoming release dates shown under "Coming Up" (edited by hand)
data/statsnz_series.json  which Stats NZ dataflow and filters give wage growth and non-tradables inflation
data/nz-regions.json  simplified outlines of the 12 regions, for the earnings map (from Natural Earth, public domain)
data/raw/             fallback copies of the source files (RBNZ spreadsheets, Stats NZ earnings and population CSVs)
favicon.svg, og-image.png, sitemap.xml, robots.txt, _headers   site extras
scripts/update_data.py  fetch + validate + write data.json and sitemap.xml
scripts/discover_statsnz.py  lists Stats NZ dataflows so you can fill in statsnz_series.json
.github/workflows/update.yml  daily cron that runs the script and commits
```

## Preview locally

`fetch()` needs a server, so run `python3 -m http.server` in this folder and open http://localhost:8000.

## Deploy

1. Push to a GitHub repo.
2. Cloudflare Pages: connect the repo, no build command, output directory `/`.
3. Every data commit redeploys the site automatically.

## Next steps

Most indicators are connected. Still to do:

1. Wage growth and non-tradables inflation: run the "Discover Stats NZ dataflows" action, then fill in `data/statsnz_series.json`
   (see "Wage growth and non-tradables" below). NZX 50 and the GDT dairy price are held back for licensing reasons: both are
   commercial data, so they need permission from NZX / Global Dairy Trade, or should be shown as links rather than figures.
2. Keep the indicator notes in `about.html` in step with what is actually connected.
3. Review attribution and licence wording for each source.

## Reserve Bank data: backup sources

The Reserve Bank's site often refuses automated downloads. For each Reserve Bank series the script tries, in order:
1. the Reserve Bank download;
2. a backup source: BIS policy rate (OCR), OECD 10-year yield via FRED, monthly (`IRLTLT01NZM156N`), Federal Reserve NZD/USD via FRED
   (`DEXUSNZ`). The TWI has no like-for-like backup. The FRED backups need `FRED_API_KEY`;
3. the copy in `data/raw/`.
Whichever of steps 2 and 3 has the newer figure is used. When a backup is used, the tile's source line says so. **The three backup
sources have not been tested against the live services**, and the BIS and FRED series codes are unverified: a failure shows as a WARNING in
the Actions log and the script just moves to the next source, so it is safe, but check the log after the first runs
(look for "NOTE: ... using the backup source"). Backup data is monthly or lagged, so it will look older than the daily Reserve Bank figures.

## If the RBNZ blocks the automatic download

The daily job tries to download the RBNZ spreadsheets. If that fails it falls back to the copies in `data/raw/`
(the script prints a WARNING and carries on, so the run still goes green). To refresh them by hand:

1. Download `hb2-daily-close.xlsx` (table B2) and `hb1-daily.xlsx` (table B1) from https://www.rbnz.govt.nz/statistics
2. Keep the file names exactly as above and upload them into `data/raw/` on GitHub (same name = replaces the old file).
3. In GitHub, go to Actions > Update data > Run workflow. The site redeploys with the new figures.

If the data goes more than 10 days without updating, the site shows a "may have stopped" notice automatically.

## Header

The header (`.topbar` in `css/style.css`) is sticky, so it stays at the top while scrolling. On screens up to 600px wide it shows the
logo, the "As of" date and a hamburger button; tapping the button drops the nav links down (`js/menu.js` adds the button and handles
open/close). If JavaScript is off, the nav just wraps onto a second row. `html { scroll-padding-top }` (72px, and 64px on phones) keeps
in-page links such as `#regions` from hiding behind the header, so change those values if you change the header's height.

## Context, recession bands, chart images and the briefing

- **"Highest since..." notes** (tiles, indicator pages, briefing) come from `context()` in `js/app.js`. It finds the last time the series was
  above or below the latest value and reports the longer look-back, or "Highest in N+ years" when the latest reading is the extreme of
  all the history held (about ten years, see `HIST_Q` / `HIST_M`). Nothing is shown if the look-back is under a year.
- **Recession bands** (grey) are worked out from the real GDP series in `data.json` by `findRecessions()`: two or more quarters in a row of
  falling real GDP. Nothing is hard-coded, so they update with the data. Region charts do not use them.
- **Chart images:** "Save chart" on each trend card and "Download chart (PNG)" on indicator and region pages call `saveChart()`, which
  saves the chart as currently shown (time range included) with a title, caption and source line. It needs no libraries.
- **Briefing:** `briefing.html` is built by `renderBriefing()`. The "Print or save as PDF" button opens the browser's print dialog, and the
  print rules at the end of `css/style.css` hide the header and footer.
- Tiles and pages show the period of the latest reading and the date the site data was last refreshed. Official release dates are not
  stored, so they are not shown.

## Wage growth and non-tradables (Stats NZ)

Both come from the Aotearoa Data Explorer, using the same `STATSNZ_API_KEY`. The dataflow IDs and the dimension codes that pick out the
right series are not known yet, so `data/statsnz_series.json` has `"dataflow": null` and the tiles stay "Coming soon".
1. GitHub > Actions > "Discover Stats NZ dataflows" > Run workflow. Open the run's log (or download the `statsnz-dataflows` artifact).
   It lists dataflows whose names mention labour cost, price indexes, wages or tradables, with a few rows of each one's data.
2. Choose the dataflow and the rows you want (for wages, the headline Labour Cost Index annual % change; for non-tradables, the
   annual % change in non-tradables prices). Put the dataflow ID in `statsnz_series.json`, and in `filters` give each dimension column
   and the code to keep, for example `{"MEASURE_XYZ": "ANN_PC", "SECTOR_XYZ": "ALL"}`. Use `"kind": "index"` if the dataflow only has an
   index level (the script then works out the annual % change).
3. Run "Update data". If the filters leave more than one value for a period the script stops with an error rather than guess.

## Release calendar

`data/releases.json` feeds the "Coming Up" section, the briefing page and the "Next release" line on indicator pages. It is edited by hand.
Reserve Bank dates are confirmed (2 Sep, 28 Oct, 9 Dec 2026 and 17 Feb 2027 are its published OCR dates). Stats NZ dates are
marked `"confirmed": false` and shown as "(expected)" because I could not verify them: replace each one with the real date from the
Stats NZ release calendar and set `"confirmed": true` (then drop the `label`). Past dates drop off automatically. The `ids` list says
which indicator pages show that release as their next one.

## Items marked "Coming soon"

Indicators with `"placeholder": true` in `data/data.json` show as greyed-out boxes with no figures. To connect one,
write its fetcher in `scripts/update_data.py` and add it to the `FETCHERS` list; the flag clears itself.
Check the licence terms for NZX and Global Dairy Trade data before connecting those two.

## Earnings by region (Stats NZ API)

The regions section reads Stats NZ's Aotearoa Data Explorer, dataflow `INC_INC_001`, through its API.

One-off setup:
1. Create an account at https://portal.apis.stats.govt.nz, open Explore APIs > Aotearoa Data Explorer > Subscribe, then copy your key from Profile.
2. In your GitHub repo: Settings > Secrets and variables > Actions > New repository secret. Name it `STATSNZ_API_KEY` and paste the key.
   Never put the key in a file or commit it (this repo is public).

If the key is missing or the API call fails, the script uses `data/raw/INC_INC_001.csv` and prints a NOTE or WARNING in the
Actions log. The figures only change once a year, so that copy is fine until the next release.

## GDP growth and unemployment (FRED)

These two come from the OECD's series on FRED (St. Louis Fed). Add a second repo secret named `FRED_API_KEY`
(free key from https://fred.stlouisfed.org > My Account > API Keys). The workflow must pass it to the job (see `update.yml`).
Without it the script uses `data/raw/NAEXKP01NZQ657S.csv` and `data/raw/LRUNTTTTNZQ156S.csv`.
FRED's NZ CPI series ended in 2023, so CPI is not connected from there.

## CPI inflation (OECD API, automatic)

CPI is fetched from the OECD's public SDMX API (no key needed) and needs no manual work.
If the download fails the script uses `data/raw/OECD_CPI_NZL.csv` and prints a WARNING.

## Consumer and business confidence (OECD API, automatic)

Fetched from the OECD's public API (dataflow DF_CLI, no key). If it fails the script uses
`data/raw/OECD_confidence_NZL.csv` and prints a WARNING.

## Current account (OECD API, automatic, no fallback file)

Fetched from the OECD balance of payments dataflow (no key). If the download fails the tile keeps its last good data;
the Actions log lists what went wrong.

## Chart history and the 1Y / 5Y / Max switch

`HIST_Q` (quarters) and `HIST_M` (months) near the top of `scripts/update_data.py` set how much history is kept (40 quarters,
120 months, about ten years). The RBNZ spreadsheets in `data/raw/` only go back to 2018, so the OCR, bond and exchange-rate
charts start there. Target bands and reference lines (CPI 1-3%, confidence 100) are set per indicator in `CFG` in `js/app.js`.

## Regional map

The map outlines come from Natural Earth admin-1 boundaries, merged into the same 12 regions Stats NZ uses and simplified to
about 20 KB. Region names in `data/nz-regions.json` must match the names in `REGION_NAMES` in `scripts/update_data.py`.

## Indicator pages

Every connected indicator tile, trend chart title and "Four Questions" link opens `indicator.html?id=<id>` (for example
`indicator.html?id=cpi`). The page is built in the browser by `renderDetail()` in `js/app.js` from `data/data.json`: a large chart
with the 1Y / 5Y / Max switch, summary figures, a "what it measures / why it matters" note (the `NOTES` list in `app.js`),
a table of past values and a CSV download. To add text for a new indicator, add an entry to `NOTES`. The update script lists
each page in `sitemap.xml`.

## Population by region

`fetch_population()` in `scripts/update_data.py` reads Stats NZ dataflow `POPPR_SUB_014` (subnational population projections,
medium scenario, both sexes, all ages) through the same API key as the earnings data (`STATSNZ_API_KEY`). Without a key it
reads `data/raw/POPPR_SUB_014.csv`. The 16 regional councils are merged into the 12 map regions (`POP_GROUPS`), and the update
fails loudly if the regions stop adding up to the national total. The base year (2023) is the newest figure in this dataset; later years are
projections at 5-year steps. The section hides itself if `data.json` has no `population` block.

## Region pages

Clicking a region on either map, or in either list, opens `region.html?r=<region name>` (for example `region.html?r=Auckland`).
`renderRegion()` in `js/app.js` builds the page from `data.json`: the region's earnings against New Zealand since 1998 (median
hourly or weekly, with a 5Y / 10Y / Max switch), the gap to New Zealand over time, the population base year and projections,
ranks among the 12 regions, a table and a CSV download. The history comes from the `history` block that `fetch_regions()` writes
under `regions` in `data.json`. The update script lists every region page in `sitemap.xml`.
