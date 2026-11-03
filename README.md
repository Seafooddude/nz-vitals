# NZ Vitals (draft)

A one-page, minimalist dashboard of New Zealand economic indicators.

## Structure

```
index.html            dashboard page
about.html            methodology (write your own indicator notes here)
css/style.css         all styling (Helvetica, white / black / Knicks blue)
js/app.js             renders cards + SVG charts from data/data.json
data/data.json        the only data file the site reads (currently placeholder)
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
