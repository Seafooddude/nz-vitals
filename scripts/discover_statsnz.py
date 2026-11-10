#!/usr/bin/env python3
"""List Stats NZ Aotearoa Data Explorer dataflows whose names match some keywords, and show a few rows of each one's data.

Use it to find the dataflow ID and the dimension codes for wage growth (Labour Cost Index) and non-tradables inflation,
then put them in data/statsnz_series.json. Needs STATSNZ_API_KEY (the same key the update job uses).

    STATSNZ_API_KEY=... python scripts/discover_statsnz.py            # default keywords
    STATSNZ_API_KEY=... python scripts/discover_statsnz.py price wage  # your own keywords
    STATSNZ_API_KEY=... python scripts/discover_statsnz.py --all       # every dataflow name

Or run the "Discover Stats NZ dataflows" workflow from the Actions tab and read its log.
"""
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET

BASE = "https://api.data.stats.govt.nz/rest/"
DEFAULT_WORDS = ["labour cost", "price index", "consumers price", "tradable", "wage"]
SAMPLE_ROWS = 40


def get(url, accept=None):
    headers = {"Ocp-Apim-Subscription-Key": os.environ.get("STATSNZ_API_KEY", ""), "User-Agent": "nz-vitals-data-bot/1.0"}
    if accept:
        headers["Accept"] = accept
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=90) as resp:
        return resp.read().decode("utf-8-sig", "replace")


def parse_flows(xml_text):
    """[(id, version, name)] from an SDMX structure message, whatever the namespace prefixes are."""
    out = []
    for el in ET.fromstring(xml_text).iter():
        if el.tag.endswith("}Dataflow") or el.tag == "Dataflow":
            name = ""
            for ch in el:
                if ch.tag.endswith("}Name") or ch.tag == "Name":
                    if ch.attrib.get("{http://www.w3.org/XML/1998/namespace}lang", "en").startswith("en") or not name:
                        name = (ch.text or "").strip()
            out.append((el.attrib.get("id", ""), el.attrib.get("version", "1.0"), name))
    return out


def main(argv):
    if not os.environ.get("STATSNZ_API_KEY"):
        sys.exit("Set STATSNZ_API_KEY first.")
    show_all = "--all" in argv
    words = [a.lower() for a in argv if not a.startswith("--")] or DEFAULT_WORDS
    flows, errors = [], []
    for path in ("dataflow/STATSNZ/all/latest?detail=allstubs", "dataflow/STATSNZ/all/latest", "dataflow/STATSNZ/all",
                 "dataflow/STATSNZ?detail=allstubs", "dataflow/all/all/latest?detail=allstubs", "dataflow"):
        try:
            flows = parse_flows(get(BASE + path))
            if flows:
                print(f"(listing worked with: {path})")
                break
            errors.append(f"{path}: no dataflows in the reply")
        except Exception as exc:
            errors.append(f"{path}: {exc}")
    if not flows:
        sys.exit("Could not list dataflows:\n  " + "\n  ".join(errors))
    print(f"{len(flows)} dataflows found.\n")
    matches = [f for f in flows if show_all or any(w in f[2].lower() or w in f[0].lower() for w in words)]
    for fid, ver, name in matches:
        print(f"{fid}  (version {ver})  {name}")
    if show_all:
        return
    print("\n---- sample data for each match (column names, then the first rows) ----")
    for fid, ver, name in matches[:15]:
        print(f"\n== {fid}: {name}")
        try:
            url = f"{BASE}data/STATSNZ,{fid},{ver}/all?lastNObservations=1&dimensionAtObservation=AllDimensions"
            rows = get(url, "application/vnd.sdmx.data+csv;labels=both").splitlines()
            print("\n".join(rows[: SAMPLE_ROWS + 1]))
            if len(rows) > SAMPLE_ROWS + 1:
                print(f"... ({len(rows) - 1} rows in total)")
        except Exception as exc:
            print(f"(could not fetch a sample: {exc})")


if __name__ == "__main__":
    main(sys.argv[1:])
