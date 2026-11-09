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
import csv
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


BROWSER_HEADERS = {
    # Some sites refuse requests that don't look like a normal browser visit.
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.8",
    "Accept-Language": "en-NZ,en;q=0.9",
    "Referer": "https://www.rbnz.govt.nz/statistics",
}


def http_get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or BROWSER_HEADERS)
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
    _ind("gdp", "Real GDP growth (q/q)", "%", "Quarterly", "OECD via FRED", "https://fred.stlouisfed.org/series/NAEXKP01NZQ657S", -15, 15),
    _ind("wages", "Wage growth (annual)", "%", "Quarterly", "Stats NZ", STATS, -2, 10),
    _ind("unemployment", "Unemployment rate", "%", "Quarterly", "OECD via FRED", "https://fred.stlouisfed.org/series/LRUNTTTTNZQ156S", 0, 20),
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


# ---- GDP growth and unemployment: OECD series distributed by FRED (St. Louis Fed) ----
# Needs a free key from https://fred.stlouisfed.org (set as FRED_API_KEY).
# Note: FRED's OECD CPI series for NZ stopped in 2023, so CPI is NOT taken from FRED.
FRED_API = "https://api.stlouisfed.org/fred/series/observations"
QUARTER_END = {1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31"}


def _fred_csv(text):
    """Parse a FRED CSV download: observation_date,SERIES_ID -> [(date, value)]."""
    rows = list(csv.reader(io.StringIO(text)))[1:]
    return [(r[0], float(r[1])) for r in rows if len(r) > 1 and r[1] not in ("", ".")]


def fred_points(series_id):
    """[(date, value)]: test file, else the FRED API (if a key is set), else data/raw copy."""
    local = os.environ.get("NZV_FRED_" + series_id)
    if local:
        return _fred_csv(Path(local).read_text(encoding="utf-8-sig"))
    key = os.environ.get("FRED_API_KEY")
    if key:
        try:
            url = f"{FRED_API}?series_id={series_id}&api_key={key}&file_type=json"
            data = json.loads(http_get(url, {"User-Agent": "nz-vitals-data-bot/1.0"}))
            points = [(o["date"], float(o["value"])) for o in data["observations"]
                      if o["value"] not in ("", ".")]
            if not points:
                raise ValueError("no observations returned")
            return points
        except Exception as exc:  # never print the URL: it contains the key
            print(f"WARNING: FRED request for {series_id} failed ({type(exc).__name__} "
                  f"{getattr(exc, 'code', '')}); using data/raw/{series_id}.csv.", file=sys.stderr)
    else:
        print("NOTE: FRED_API_KEY is not set; using the copies in data/raw/.", file=sys.stderr)
    return _fred_csv((RAW_DIR / f"{series_id}.csv").read_text(encoding="utf-8-sig"))


def quarterly(points, quarters=12):
    """Last N quarters. FRED dates are quarter starts; we store quarter ends plus a label."""
    out = []
    for d, v in points[-quarters:]:
        y, q = int(d[:4]), (int(d[5:7]) - 1) // 3 + 1
        out.append({"date": f"{y}-{QUARTER_END[q]}", "label": f"{y} Q{q}", "value": round(v, 2)})
    return out


def fetch_gdp():
    return quarterly(fred_points("NAEXKP01NZQ657S"))


def fetch_unemployment():
    return quarterly(fred_points("LRUNTTTTNZQ156S"))


FETCHERS = {"cpi": fetch_cpi, "gdp": fetch_gdp, "unemployment": fetch_unemployment,
            "ocr": fetch_ocr, "nzdusd": fetch_nzdusd,
            "twi": fetch_twi, "bond10": fetch_bond10}


# ---- Earnings by region: Stats NZ Aotearoa Data Explorer (dataflow INC_INC_001) ----
# The query is the one the Explorer's "Developer API" panel gives for: all regions,
# all measures, all years, total ethnic groups / both sexes / all ages.
# Needs a free key from https://portal.apis.stats.govt.nz (set as STATSNZ_API_KEY).
ADE_URL = ("https://api.data.stats.govt.nz/rest/data/STATSNZ,INC_INC_001,1.0/"
           ".98..98.98.?dimensionAtObservation=AllDimensions")
ADE_FALLBACK = RAW_DIR / "INC_INC_001.csv"
REGION_NAMES = {
    "1": "Northland", "2": "Auckland", "3": "Waikato", "4": "Bay of Plenty",
    "5": "Gisborne/Hawke's Bay", "6": "Taranaki", "7": "Manawatu-Whanganui",
    "8": "Wellington", "9": "Nelson/Tasman/Marlborough/West Coast",
    "10": "Canterbury", "11": "Otago", "12": "Southland",
    "98": "New Zealand",
}
MEASURES = {"MED_HOUR_INC": "median_hourly", "MED_WEEK_INC": "median_weekly", "NO_PEOPLE": "people"}
LIMITS = {"median_hourly": (10, 80), "median_weekly": (300, 4000), "people": (1, 3000)}


def ade_text():
    """CSV text: test file, else the Stats NZ API (if a key is set), else data/raw copy."""
    local = os.environ.get("NZV_ADE_FILE")
    if local:
        return Path(local).read_text(encoding="utf-8-sig")
    key = os.environ.get("STATSNZ_API_KEY")
    if key:
        try:
            headers = {"Ocp-Apim-Subscription-Key": key, "Accept": "application/vnd.sdmx.data+csv",
                       "User-Agent": "nz-vitals-data-bot/1.0"}
            text = http_get(ADE_URL, headers).decode("utf-8-sig")
            if "OBS_VALUE" not in text.split("\n", 1)[0]:
                raise ValueError("response was not SDMX-CSV")
            return text
        except Exception as exc:
            print(f"WARNING: Stats NZ API request failed ({exc}); using data/raw/{ADE_FALLBACK.name}.",
                  file=sys.stderr)
    else:
        print("NOTE: STATSNZ_API_KEY is not set; using the copy in data/raw/.", file=sys.stderr)
    return ADE_FALLBACK.read_text(encoding="utf-8-sig")


def _find(cols, *names):
    """Find a column by id, tolerating 'ID: label' style headers."""
    for n in names:
        for c in cols:
            if c.strip() == n or c.strip().startswith(n + ":"):
                return c
    raise ValueError(f"column {names[0]} not found (columns: {', '.join(cols)[:200]})")


def _code(value):
    """'6' and '6: Taranaki Region' both give '6'."""
    return value.split(":", 1)[0].strip()


def fetch_regions():
    reader = csv.DictReader(io.StringIO(ade_text()))
    cols = reader.fieldnames or []
    c_per = _find(cols, "PERIOD_INC_INC_001", "TIME_PERIOD")
    c_reg = _find(cols, "LGR_INC_INC_001")
    c_mea = _find(cols, "MEASURE_INC_INC_001")
    c_val = _find(cols, "OBS_VALUE")

    cells = {}  # (year, region code, measure) -> value
    for row in reader:
        measure = MEASURES.get(_code(row[c_mea]))
        if measure is None or not (row[c_val] or "").strip():
            continue
        region = _code(row[c_reg])
        if region not in REGION_NAMES:
            raise ValueError(f"unknown region code {region!r}: Stats NZ may have changed the regions")
        cells[(row[c_per].strip()[:4], region, measure)] = float(row[c_val])

    years = sorted({k[0] for k in cells})
    if len(years) < 2:
        raise ValueError("fewer than two years of data")
    latest, previous = years[-1], years[-2]

    items, national = [], None
    for code, name in REGION_NAMES.items():
        cur = {m: cells.get((latest, code, m)) for m in MEASURES.values()}
        if None in cur.values():
            raise ValueError(f"{name}: missing {latest} figures")
        for m, v in cur.items():
            lo, hi = LIMITS[m]
            if not lo <= v <= hi:
                raise ValueError(f"{name} {m} out of range: {v}")
        entry = dict(cur,
                     prev_median_hourly=cells.get((previous, code, "median_hourly")),
                     prev_median_weekly=cells.get((previous, code, "median_weekly")))
        if code == "98":
            national = entry
        else:
            items.append(dict(entry, name=name))
    return {"title": "Earnings by region", "source": "Stats NZ",
            "url": "https://explore.data.stats.govt.nz/", "latest": latest, "previous": previous,
            "periodLabel": f"June {latest}", "national": national, "items": items}


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

    regions = old.get("regions")
    try:
        regions = fetch_regions()
    except Exception as exc:  # keep the previous regions block
        errors.append(f"regions: {exc}")

    # Only treat it as an update if the numbers actually changed. This stops
    # a pointless commit and redeploy every day when nothing new was published.
    today = date.today().isoformat()
    changed = out != old.get("indicators") or regions != old.get("regions")
    result = {"updated": today if changed else old.get("updated", today),
              "placeholder": any(e.get("placeholder") for e in out),
              "indicators": out}
    if regions:
        result["regions"] = regions
    DATA_FILE.write_text(json.dumps(result, indent=2) + "\n")
    if changed:
        bump_sitemap(today)

    if errors:
        print("Problems:\n" + "\n".join(errors), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
