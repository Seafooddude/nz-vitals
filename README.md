# NZ Vitals (draft)

A one-page, minimalist dashboard of New Zealand economic indicators.

## Structure

```
index.html            dashboard page
about.html            methodology (write your own indicator notes here)
css/style.css         all styling (Helvetica, white / black / Knicks blue)
js/app.js             renders cards + SVG charts from data/data.json
data/data.json        the only data file the site reads
data/raw/             fallback copies of the RBNZ spreadsheets (see below)
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
