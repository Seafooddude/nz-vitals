#!/usr/bin/env python3
"""Fetch NZ indicators, validate them, and write data/data.json.

Design rules:
- One fetcher per indicator, each returning [{"date": str, "value": float}, ...].
- A fetcher that is not written yet (NotImplementedError) is skipped quietly and
  that indicator keeps its existing data, flagged "placeholder".
- A fetcher that breaks, or fails validation, keeps the previous data and makes
  the script exit non-zero so the GitHub Action emails you.
- Always overwrite the full series (sources revise past values).

Testing without the network: set NZV_B2_FILE / NZV_B1_FILE to downloaded copies
of hb2-daily-close.xlsx / hb1-daily.xlsx.
"""
import io
import json
import os
import re
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "data.json"
SITEMAP_FILE = ROOT / "sitemap.xml"

# RBNZ statistical tables. Licence: free to copy and adapt, with attribution.
RBNZ_BASE = "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/b/"
B2_URL = RBNZ_BASE + "b2/hb2-daily-close.xlsx"   # daily wholesale interest rates
B1_URL = RBNZ_BASE + "b1/hb1-daily.xlsx"         # daily exchange rates and TWI
OCR_SERIES_ID = "INM.DP1.N"      # Official Cash Rate (OCR), %pa
NZDUSD_SERIES_ID = "EXR.DS11.D06"  # United States dollar, NZD/USD
TWI_SERIES_ID = "EXRT.DS41.NZB17"  # Trade-weighted index, 17 currency basket
BOND10_SERIES_ID = "INM.DG110.NZZCF"  # Govt bond closing yield, 10 year, %pa


def bump_sitemap(today):
    """Set the home page's <lastmod> to today (the about page is left alone)."""
    xml = SITEMAP_FILE.read_text()
    new = re.sub(r"(<loc>[^<]*/</loc>\s*<lastmod>)[^<]*(</lastmod>)", r"\g<1>" + today + r"\g<2>", xml, count=1)
    SITEMAP_FILE.write_text(new)


def http_get(url):
    # Some sites refuse requests that don't look like a normal browser visit.
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.8",
        "Accept-Language": "en-NZ,en;q=0.9",
        "Referer": "https://www.rbnz.govt.nz/statistics",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


_RAW = {}  # url -> file bytes, so B1/B2 are downloaded once even if used twice
RAW_DIR = ROOT / "data" / "raw"  # fallback copies you upload by hand if downloads are blocked


def get_file(url, env_var):
    """Return an RBNZ spreadsheet as bytes: test file, else download, else data/raw copy."""
    if url in _RAW:
        return _RAW[url]
    local = os.environ.get(env_var)
    if local:
        raw = Path(local).read_bytes()
    else:
        try:
            raw = http_get(url)
            if not raw.startswith(b"PK"):  # .xlsx files are zip files
                raise ValueError("response was not an Excel file")
        except Exception as exc:
            fallback = RAW_DIR / url.rsplit("/", 1)[-1]
            if not fallback.exists():
                raise
            print(f"WARNING: download failed ({exc}); using {fallback.name} from the repo.", file=sys.stderr)
            raw = fallback.read_bytes()
    _RAW[url] = raw
    return raw


def rbnz_points(url, env_var, series_id):
    """Return [(datetime, float), ...] for one series in an RBNZ 'Data' sheet.

    The column is found by its Series Id, so a reordered file doesn't break us.
    """
    raw = get_file(url, env_var)
    wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    rows = wb["Data"].iter_rows(values_only=True)

    col = None
    for row in rows:
        if row and row[0] == "Series Id":
            if series_id not in row:
                raise ValueError(f"series {series_id} not found in file")
            col = row.index(series_id)
            break
    if col is None:
        raise ValueError("'Series Id' row not found: file layout has changed")

    points = [(r[0], float(r[col])) for r in rows
              if isinstance(r[0], datetime) and isinstance(r[col], (int, float))]
    if not points:
        raise ValueError(f"no observations found for {series_id}")
    return points


STATS = "https://www.stats.govt.nz/"
RBNZ = "Reserve Bank of New Zealand"


def _ind(id, name, unit, freq, source, url, lo, hi):
    return {"id": id, "name": name, "unit": unit, "frequency": freq,
            "source": source, "url": url, "min": lo, "max": hi}


# Order here = order of the tiles on the page. Only the series is fetched.
INDICATORS = [
    _ind("gdp", "Real GDP growth (q/q)", "%", "Quarterly", "Stats NZ", STATS, -5, 5),
    _ind("wages", "Wage growth (annual)", "%", "Quarterly", "Stats NZ", STATS, -2, 10),
    _ind("unemployment", "Unemployment rate", "%", "Quarterly", "Stats NZ", STATS, 0, 20),
    _ind("cpi", "Annual CPI inflation", "%", "Quarterly", "Stats NZ", STATS, -5, 20),
    _ind("nontradables", "Non-tradables inflation (annual)", "%", "Quarterly", "Stats NZ", STATS, -5, 15),
    _ind("houses", "House price growth (annual)", "%", "Monthly", "REINZ", "https://www.reinz.co.nz/", -30, 40),
    _ind("ocr", "Official Cash Rate", "%", "Per RBNZ review", RBNZ, "https://www.rbnz.govt.nz/statistics/b2", 0, 10),
    _ind("bond10", "10-year government bond yield", "%", "Daily", RBNZ, "https://www.rbnz.govt.nz/statistics/b2", 0, 12),
    _ind("nzx50", "NZX 50 index", "index", "Daily", "NZX", "https://www.nzx.com/", 1000, 30000),
    _ind("gdt", "Dairy price (GDT whole milk powder)", "US$/t", "Fortnightly", "Global Dairy Trade", "https://www.globaldairytrade.info/", 500, 10000),
    _ind("nzdusd", "NZD/USD exchange rate", "NZD/USD", "Daily", RBNZ, "https://www.rbnz.govt.nz/statistics/b1", 0.3, 1.2),
    _ind("twi", "NZ dollar (TWI)", "index", "Daily", RBNZ, "https://www.rbnz.govt.nz/statistics/b1", 40, 100),
]


def fetch_cpi():
    raise NotImplementedError("TODO: Stats NZ CPI (Aotearoa Data Explorer API or CSV)")


def fetch_unemployment():
    raise NotImplementedError("TODO: Stats NZ Household Labour Force Survey")


def fetch_ocr(max_changes=6):
    """OCR as a short series: each of the last few changes, plus the latest day.

    The RBNZ file is daily, but the OCR only moves a handful of times a year,
    so we keep the change points. That also lets the caption say "unchanged
    since <date of last change>" when the rate has held.
    """
    points = rbnz_points(B2_URL, "NZV_B2_FILE", OCR_SERIES_ID)
    changes = [points[0]] + [cur for prev, cur in zip(points, points[1:]) if cur[1] != prev[1]]
    chosen = changes[-max_changes:]
    if chosen[-1][0] != points[-1][0]:
        chosen.append(points[-1])  # latest day, so the card shows how current it is
    return [{"date": d.date().isoformat(), "value": v} for d, v in chosen]


def month_ends(points, months=12):
    """Last observation of each of the last `months` months, plus the latest day."""
    last_of_month = {}
    for d, v in points:
        last_of_month[(d.year, d.month)] = (d, v)  # later days overwrite earlier ones
    chosen = list(last_of_month.values())[-months:]
    if chosen[-1][0] != points[-1][0]:
        chosen.append(points[-1])
    return [{"date": d.date().isoformat(), "value": v} for d, v in chosen]


def fetch_nzdusd():
    return month_ends(rbnz_points(B1_URL, "NZV_B1_FILE", NZDUSD_SERIES_ID))


def fetch_twi():
    return month_ends(rbnz_points(B1_URL, "NZV_B1_FILE", TWI_SERIES_ID))


def fetch_bond10():
    return month_ends(rbnz_points(B2_URL, "NZV_B2_FILE", BOND10_SERIES_ID))


FETCHERS = {"cpi": fetch_cpi, "unemployment": fetch_unemployment,
            "ocr": fetch_ocr, "nzdusd": fetch_nzdusd,
            "twi": fetch_twi, "bond10": fetch_bond10}


def validate(meta, series):
    if not series or len(series) < 2:
        raise ValueError("series too short")
    for point in series:
        v = point["value"]
        if not isinstance(v, (int, float)) or not (meta["min"] <= v <= meta["max"]):
            raise ValueError(f"value out of range: {point}")


def main():
    old = json.loads(DATA_FILE.read_text()) if DATA_FILE.exists() else {"indicators": []}
    old_by_id = {i["id"]: i for i in old["indicators"]}
    out, errors = [], []

    for meta in INDICATORS:
        entry = {k: meta[k] for k in ("id", "name", "unit", "frequency", "source", "url")}
        try:
            fetcher = FETCHERS.get(meta["id"])
            if fetcher is None:  # no fetcher written yet: keep the placeholder
                raise NotImplementedError(meta["id"])
            series = fetcher()
            validate(meta, series)
            entry["series"] = series
        except Exception as exc:  # keep last good data for this indicator
            if not isinstance(exc, NotImplementedError):
                errors.append(f"{meta['id']}: {exc}")
            prev = old_by_id.get(meta["id"])
            if prev is None:
                continue
            entry["series"] = prev["series"]
            if prev.get("placeholder"):
                entry["placeholder"] = True
        out.append(entry)

    # Only treat it as an update if the numbers actually changed. This stops
    # a pointless commit and redeploy every day when nothing new was published.
    today = date.today().isoformat()
    changed = out != old.get("indicators")
    result = {"updated": today if changed else old.get("updated", today),
              "placeholder": any(e.get("placeholder") for e in out),
              "indicators": out}
    DATA_FILE.write_text(json.dumps(result, indent=2) + "\n")
    if changed:
        bump_sitemap(today)

    if errors:
        print("Problems:\n" + "\n".join(errors), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
