#!/usr/bin/env python3
"""Build data/regional_profile.json from the MBIE Regional Economic Activity download (all-data.csv).

The download is about 280 MB, so it is not kept in the repo. Run this by hand when MBIE publishes new figures
(regional GDP is annual, published around March):

    python scripts/build_regional_profile.py path/to/all-data.csv

Source: Ministry of Business, Innovation & Employment, Regional Economic Activity web tool (https://webrear.mbie.govt.nz/).
The figures come from Stats NZ regional GDP and business demography. All rows in the download are licensed CC BY 4.0.
The 16 regional councils are combined into the same 12 regions as the earnings data and the map.
"""
import csv
import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "regional_profile.json"

GROUPS = {
    "Northland": ["Northland"], "Auckland": ["Auckland"], "Waikato": ["Waikato"], "Bay of Plenty": ["Bay of Plenty"],
    "Gisborne/Hawke's Bay": ["Gisborne", "Hawke's Bay"], "Taranaki": ["Taranaki"], "Manawatu-Whanganui": ["Manawatu-Wanganui"],
    "Wellington": ["Wellington"],
    "Nelson/Tasman/Marlborough/West Coast": ["Nelson", "Tasman", "Marlborough", "West Coast"],
    "Canterbury": ["Canterbury"], "Otago": ["Otago"], "Southland": ["Southland"],
}
COUNCILS = {c for cs in GROUPS.values() for c in cs} | {"New Zealand"}
TOP_INDUSTRIES = 6
# Not industries in the usual sense: taxes on products, and the rent owner-occupiers are assumed to pay themselves.
NOT_INDUSTRIES = ("GST on production", "owner-occupied property")


def main(path):
    gdp = defaultdict(dict)       # area -> year -> $ million
    pc = defaultdict(dict)        # area -> year -> GDP per capita, dollars
    biz = defaultdict(lambda: defaultdict(float))   # area -> year -> business units (all size bands)
    ind = defaultdict(lambda: defaultdict(dict))    # area -> year -> industry -> $ million
    with open(path, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r["area"] not in COUNCILS or r["transform"] != "original" or not r["value"]:
                continue
            a, y, v = r["area"], int(r["year"]), float(r["value"])
            if r["indicator"] == "GDP totals":
                gdp[a][y] = v
            elif r["indicator"] == "GDP per capita":
                pc[a][y] = v
            elif r["indicator"] == "businesses by employees":
                biz[a][y] += v
            elif r["indicator"] == "GDP by industry":
                ind[a][y][r["feature"]] = v
    if not gdp or not pc:
        sys.exit("No regional GDP rows found: is this the MBIE all-data.csv?")

    years = sorted(set.intersection(*[set(gdp[a]) & set(pc[a]) for a in COUNCILS]))
    byears = sorted(set.intersection(*[set(biz[a]) for a in COUNCILS]))
    latest, blatest = years[-1], byears[-1]
    iyear = max(y for y in ind["Auckland"] if all(y in ind[a] for a in COUNCILS))

    def combine(councils):
        """Sum GDP and business units; population is implied by GDP / GDP per capita, so each year lines up with MBIE's."""
        g, p, b = [], [], []
        for y in years:
            tot = sum(gdp[c][y] for c in councils)
            pop = sum(gdp[c][y] * 1e6 / pc[c][y] for c in councils)
            g.append(round(tot))
            p.append(round(tot * 1e6 / pop))
        for y in byears:
            b.append(round(sum(biz[c][y] for c in councils)))
        shares = defaultdict(float)
        for c in councils:
            for k, v in ind[c][iyear].items():
                shares[k] += v
        total = sum(shares.values())
        top = sorted((kv for kv in shares.items() if not kv[0].startswith(NOT_INDUSTRIES)), key=lambda kv: -kv[1])[:TOP_INDUSTRIES]
        return {"gdp": g, "gdpPerCapita": p, "businesses": b,
                "industries": [{"name": k, "share": round(v / total * 100, 1),
                                "nzShare": round(nz_ind.get(k, 0) / nz_total * 100, 1)} for k, v in top]}

    nz_ind = dict(ind["New Zealand"][iyear])
    nz_total = sum(nz_ind.values())
    regions = {name: combine(cs) for name, cs in GROUPS.items()}
    nz = combine(["New Zealand"])
    # sanity: regions should add up to New Zealand (the totals can differ a little because of rounding and 'regional not stated')
    for key in ("gdp", "businesses"):
        i = -1
        s = sum(r[key][i] for r in regions.values())
        if abs(s / nz[key][i] - 1) > 0.03:
            print(f"WARNING: regions add up to {s}, New Zealand is {nz[key][i]} ({key}); check the mapping.", file=sys.stderr)

    out = {
        "updated": date.today().isoformat(),
        "title": "Regional economic profile",
        "source": "Ministry of Business, Innovation & Employment (Regional Economic Activity), from Stats NZ data",
        "url": "https://webrear.mbie.govt.nz/",
        "licence": "CC BY 4.0",
        "gdpYears": years, "gdpPeriod": f"year to March {latest}",
        "businessYears": byears, "industryYear": iyear,
        "national": nz, "regions": regions,
    }
    OUT.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB): GDP {years[0]}-{latest}, business units {byears[0]}-{blatest}, industries {iyear}.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
