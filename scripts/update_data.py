#!/usr/bin/env python3
"""Fetch NZ indicators, validate them, and write data/data.json.

Design rules:
- One fetcher per indicator, each returning [{"date": str, "value": float}, ...].
- If any fetcher fails or its output fails validation, keep that indicator's
  previous data and exit non-zero so the GitHub Action emails you.
- Always overwrite the full series (sources revise past values).

DRAFT: the fetchers below are stubs. Fill in each one with the real source
(Stats NZ / RBNZ) once you've chosen the exact series.
"""
import json
import sys
from datetime import date
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "data.json"

# Static metadata lives here; only the series is fetched.
INDICATORS = [
    {"id": "cpi", "name": "Annual CPI inflation", "unit": "%", "frequency": "Quarterly",
     "source": "Stats NZ", "url": "https://www.stats.govt.nz/", "min": -5, "max": 20},
    {"id": "unemployment", "name": "Unemployment rate", "unit": "%", "frequency": "Quarterly",
     "source": "Stats NZ", "url": "https://www.stats.govt.nz/", "min": 0, "max": 20},
    {"id": "ocr", "name": "Official Cash Rate", "unit": "%", "frequency": "Per RBNZ review",
     "source": "Reserve Bank of New Zealand", "url": "https://www.rbnz.govt.nz/", "min": 0, "max": 10},
    {"id": "nzdusd", "name": "NZD/USD exchange rate", "unit": "NZD/USD", "frequency": "Daily",
     "source": "Reserve Bank of New Zealand", "url": "https://www.rbnz.govt.nz/", "min": 0.3, "max": 1.2},
]


def fetch_cpi():
    raise NotImplementedError("TODO: Stats NZ CPI (Aotearoa Data Explorer API or CSV)")


def fetch_unemployment():
    raise NotImplementedError("TODO: Stats NZ Household Labour Force Survey")


def fetch_ocr():
    raise NotImplementedError("TODO: RBNZ OCR statistical table")


def fetch_nzdusd():
    raise NotImplementedError("TODO: RBNZ exchange rates statistical table")


FETCHERS = {"cpi": fetch_cpi, "unemployment": fetch_unemployment,
            "ocr": fetch_ocr, "nzdusd": fetch_nzdusd}


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
            series = FETCHERS[meta["id"]]()
            validate(meta, series)
            entry["series"] = series
        except Exception as exc:  # keep last good data for this indicator
            errors.append(f"{meta['id']}: {exc}")
            if meta["id"] not in old_by_id:
                continue
            entry["series"] = old_by_id[meta["id"]]["series"]
        out.append(entry)

    result = {"updated": date.today().isoformat(), "placeholder": bool(errors) and old.get("placeholder", False),
              "indicators": out}
    DATA_FILE.write_text(json.dumps(result, indent=2) + "\n")

    if errors:
        print("Problems:\n" + "\n".join(errors), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
