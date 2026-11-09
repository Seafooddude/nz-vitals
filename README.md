# NZ Vitals (draft)

A one-page, minimalist dashboard of New Zealand economic indicators.

## Structure

```
index.html            dashboard page
about.html            methodology (write your own indicator notes here)
css/style.css         all styling (Helvetica, white / black / Knicks blue)
js/app.js             renders cards + SVG charts from data/data.json
data/data.json        the only data file the site reads
data/raw/             fallback copies of the source files (RBNZ spreadsheets + Stats NZ earnings CSV)
favicon.svg, og-image.png, sitemap.xml, robots.txt, _headers   site extras
scripts/update_data.py  fetch + validate + write data.json (fetchers are stubs)
.github/workflows/update.yml  daily cron that runs the script and commits
```

## Preview locally

`fetch()` needs a server, so run `python3 -m http.server` in this folder and open http://localhost:8000.

## Deploy

1. Push to a GitHub repo.
2. Cloudflare Pages: connect the repo, no build command, output directory `/`.
3. Every data commit redeploys the site automatically.

## Next steps

1. Fill in one fetcher in `scripts/update_data.py` (start with the OCR) and check the output.
2. Repeat for the other indicators. The "placeholder data" banner disappears once all fetchers succeed.
3. Write the indicator notes in `about.html`.
4. Add attribution and licence wording for each source.

## If the RBNZ blocks the automatic download

The daily job tries to download the RBNZ spreadsheets. If that fails it falls back to the copies in `data/raw/`
(the script prints a WARNING and carries on, so the run still goes green). To refresh them by hand:

1. Download `hb2-daily-close.xlsx` (table B2) and `hb1-daily.xlsx` (table B1) from https://www.rbnz.govt.nz/statistics
2. Keep the file names exactly as above and upload them into `data/raw/` on GitHub (same name = replaces the old file).
3. In GitHub, go to Actions > Update data > Run workflow. The site redeploys with the new figures.

If the data goes more than 10 days without updating, the site shows a "may have stopped" notice automatically.

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
