#!/usr/bin/env python3
"""
Build committed JSON data snapshots used by the BFI demo.

Sources (not committed to this repo):
  - Global Cement and Concrete Tracker (GCCT) July 2025 release, "Plant Data" sheet
  - GEM Ownership dataset (entities, entity-asset, entity-relationships CSVs)
  - Climate TRACE Nepal 2024 facility emissions snapshot (from data/_raw_ct_emis_2024.csv)

Outputs (committed to data/):
  - data/cement-plants-npl.json        - all operating Nepal cement plants from GCCT
  - data/hydropower-operators-npl.json - curated list of major Nepal hydropower operators
  - data/industrial-entities-npl.json  - other real Nepal industrial entities (steel, sugar, FMCG)
  - data/ct-nepal-2024.json            - all 213 Climate TRACE Nepal facilities for 2024

Run with explicit source paths (defaults assume macOS Downloads + ownership repo):
  python3 scripts/build-data-snapshots.py \
    --gcct /Users/willardmechem/Downloads/Global-Cement-and-Concrete-Tracker_July-2025.xlsx \
    --ownership-dir /Users/willardmechem/Projects/repos/ownership
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def parse_coords(s: str | None) -> tuple[float | None, float | None]:
    if not s or not isinstance(s, str):
        return None, None
    try:
        a, b = s.split(",")
        return float(a.strip()), float(b.strip())
    except Exception:
        return None, None


def clean_owner(name: str | None) -> str | None:
    """Strip the trailing percent annotation, e.g. 'Arghakhanchi Cement Ltd [100.0%]'."""
    if not name:
        return None
    name = name.strip()
    if "[" in name:
        name = name.split("[", 1)[0].strip()
    return name or None


def build_cement_plants(gcct_path: Path) -> list[dict]:
    import openpyxl

    wb = openpyxl.load_workbook(gcct_path, read_only=True, data_only=True)
    ws = wb["Plant Data"]
    rows = list(ws.iter_rows(values_only=True))
    header = [h for h in rows[0] if h]

    def col(name: str) -> int:
        return header.index(name)

    ci = col("Country/Area")
    status_i = col("Operating status")
    out: list[dict] = []
    for r in rows[1:]:
        if r[ci] != "Nepal":
            continue
        if r[status_i] != "operating":
            continue
        lat, lng = parse_coords(r[col("Coordinates")])
        cap = r[col("Cement Capacity (millions metric tonnes per annum)")]
        clinker = r[col("Clinker Capacity (millions metric tonnes per annum)")]
        out.append(
            {
                "gemPlantId": r[col("GEM Plant ID")],
                "name": r[col("GEM Asset name (English)")],
                "nameLocal": r[col("Asset name (other language)")],
                "altNames": (
                    None
                    if r[col("Alternative asset name(s)")] in (None, "n/a")
                    else r[col("Alternative asset name(s)")]
                ),
                "municipality": r[col("Municipality")],
                "subnationalUnit": r[col("Subnational unit")],
                "lat": lat,
                "lng": lng,
                "coordinateAccuracy": r[col("Coordinate accuracy")],
                "cementCapacityMtpa": cap if isinstance(cap, (int, float)) else None,
                "clinkerCapacityMtpa": (
                    clinker if isinstance(clinker, (int, float)) else None
                ),
                "majorityCementType": r[col("Majority Cement Type")],
                "color": r[col("Cement Color")],
                "startDate": str(r[col("Start date")]) if r[col("Start date")] else None,
                "owner": clean_owner(r[col("Owner name (English)")]),
                "ownerEntityId": r[col("Owner Entity ID")],
                "parent": (
                    None
                    if r[col("Parent")] in (None, "n/a", "")
                    else clean_owner(r[col("Parent")])
                ),
                "parentEntityId": r[col("Parent Entity ID")],
                "plantType": r[col("Plant type")],
                "productionType": r[col("Production type")],
                "wikiPage": r[col("GEM wiki page")],
                "sfiId": r[col("SFI ID")] if r[col("SFI ID")] != "n/a" else None,
            }
        )
    return out


def hand_curated_hydropower() -> list[dict]:
    """Major operating Nepal hydropower operators. Curated for the demo.

    Sources: NEA annual reports, IHA Hydropower Profile Nepal, sector public filings.
    All locations approximate plant-headworks coordinates.
    """
    return [
        {
            "name": "Nepal Electricity Authority",
            "shortName": "NEA",
            "ownership": "state-owned",
            "ownerCountry": "NPL",
            "operatingStations": [
                {"name": "Kulekhani I", "capacityMw": 60, "lat": 27.583, "lng": 85.157},
                {"name": "Kulekhani II", "capacityMw": 32, "lat": 27.604, "lng": 85.179},
                {"name": "Kulekhani III", "capacityMw": 14, "lat": 27.619, "lng": 85.195},
                {"name": "Marsyangdi", "capacityMw": 69, "lat": 27.973, "lng": 84.412},
                {"name": "Trishuli", "capacityMw": 24, "lat": 27.917, "lng": 85.150},
                {"name": "Devighat", "capacityMw": 14, "lat": 27.851, "lng": 85.169},
            ],
            "note": "Largest single utility operator; vertically integrated.",
        },
        {
            "name": "Chilime Hydropower Company Limited",
            "shortName": "Chilime",
            "ownership": "publicly-listed",
            "ownerCountry": "NPL",
            "operatingStations": [
                {"name": "Chilime", "capacityMw": 22.1, "lat": 28.220, "lng": 85.323},
            ],
            "note": "NEPSE-listed; subsidiary of NEA group.",
        },
        {
            "name": "Butwal Power Company Limited",
            "shortName": "BPC",
            "ownership": "publicly-listed",
            "ownerCountry": "NPL",
            "operatingStations": [
                {"name": "Jhimruk", "capacityMw": 12.3, "lat": 28.030, "lng": 82.760},
                {"name": "Andhi Khola", "capacityMw": 9.4, "lat": 27.951, "lng": 83.793},
            ],
            "note": "Oldest private IPP in Nepal.",
        },
        {
            "name": "Sanima Mai Hydropower Limited",
            "shortName": "Sanima Mai",
            "ownership": "publicly-listed",
            "ownerCountry": "NPL",
            "operatingStations": [
                {"name": "Mai Hydropower", "capacityMw": 22, "lat": 26.985, "lng": 87.954},
                {"name": "Mai Cascade", "capacityMw": 7, "lat": 26.999, "lng": 87.960},
            ],
            "note": "Sanima group; eastern Nepal.",
        },
        {
            "name": "Himal Power Limited",
            "shortName": "HPL",
            "ownership": "private",
            "ownerCountry": "NPL",
            "operatingStations": [
                {"name": "Khimti I", "capacityMw": 60, "lat": 27.594, "lng": 86.193},
            ],
            "note": "BOOT operator (Norway-Nepal JV historically).",
        },
        {
            "name": "Upper Tamakoshi Hydropower Limited",
            "shortName": "Upper Tamakoshi",
            "ownership": "publicly-listed",
            "ownerCountry": "NPL",
            "operatingStations": [
                {"name": "Upper Tamakoshi", "capacityMw": 456, "lat": 27.802, "lng": 86.180},
            ],
            "note": "Largest domestic IPP project; NEA-affiliated.",
        },
    ]


def hand_curated_industrial() -> list[dict]:
    """Non-cement, non-hydro Nepal industrial entities relevant to the demo."""
    return [
        {
            "name": "Bottlers Nepal (Terai) Limited",
            "sector": "manufacturing-fmcg",
            "subsector": "beverages",
            "ownership": "publicly-listed",
            "parent": "Coca-Cola Sabco / Coca-Cola Beverages Africa",
            "facilities": [
                {"name": "Bharatpur Bottling Plant", "lat": 27.683, "lng": 84.434},
            ],
        },
        {
            "name": "Bottlers Nepal Limited",
            "sector": "manufacturing-fmcg",
            "subsector": "beverages",
            "ownership": "publicly-listed",
            "parent": "Coca-Cola Sabco / Coca-Cola Beverages Africa",
            "facilities": [
                {"name": "Balaju Bottling Plant", "lat": 27.732, "lng": 85.299},
            ],
        },
        {
            "name": "Unilever Nepal Limited",
            "sector": "manufacturing-fmcg",
            "subsector": "personal-care",
            "ownership": "publicly-listed",
            "parent": "Unilever plc",
            "facilities": [
                {"name": "Hetauda Factory", "lat": 27.428, "lng": 85.033},
            ],
        },
        {
            "name": "Nepal Lube Oil Limited",
            "sector": "manufacturing-chemicals",
            "subsector": "lubricants",
            "ownership": "publicly-listed",
            "parent": None,
            "facilities": [
                {"name": "Hetauda Blending Plant", "lat": 27.430, "lng": 85.038},
            ],
        },
        {
            "name": "Shree Ram Sugar Mills",
            "sector": "agriculture-processing",
            "subsector": "sugar",
            "ownership": "private",
            "parent": None,
            "facilities": [
                {"name": "Garuda Sugar Mill", "lat": 26.997, "lng": 85.011},
            ],
        },
        {
            "name": "Sri Ram Sugar Mills Pvt Ltd",
            "sector": "agriculture-processing",
            "subsector": "sugar",
            "ownership": "private",
            "parent": None,
            "facilities": [
                {"name": "Birgunj Mill", "lat": 27.012, "lng": 84.872},
            ],
        },
        {
            "name": "Indu Shankar Sugar Mills",
            "sector": "agriculture-processing",
            "subsector": "sugar",
            "ownership": "private",
            "parent": None,
            "facilities": [
                {"name": "Hariwan Mill", "lat": 27.005, "lng": 85.531},
            ],
        },
        {
            "name": "Himal Iron and Steel Pvt Ltd",
            "sector": "manufacturing-steel",
            "subsector": "re-rolling",
            "ownership": "private",
            "parent": None,
            "facilities": [
                {"name": "Birgunj Mill", "lat": 27.024, "lng": 84.891},
            ],
        },
        {
            "name": "Hulas Steel Industries Ltd",
            "sector": "manufacturing-steel",
            "subsector": "re-rolling",
            "ownership": "private",
            "parent": "Golchha Organisation",
            "facilities": [
                {"name": "Simara Plant", "lat": 27.166, "lng": 84.991},
            ],
        },
        {
            "name": "Panchakanya Steels Pvt Ltd",
            "sector": "manufacturing-steel",
            "subsector": "tmt-bars",
            "ownership": "private",
            "parent": "Panchakanya Group",
            "facilities": [
                {"name": "Birgunj Plant", "lat": 27.027, "lng": 84.880},
            ],
        },
        {
            "name": "Reliance Spinning Mills Ltd",
            "sector": "manufacturing-textiles",
            "subsector": "spinning",
            "ownership": "private",
            "parent": "Reliance Group (Nepal)",
            "facilities": [
                {"name": "Birgunj Plant", "lat": 27.020, "lng": 84.875},
            ],
        },
        {
            "name": "Surya Nepal Pvt Ltd",
            "sector": "manufacturing-fmcg",
            "subsector": "tobacco-apparel",
            "ownership": "private",
            "parent": "ITC Limited",
            "facilities": [
                {"name": "Simara Factory", "lat": 27.170, "lng": 84.985},
            ],
        },
        {
            "name": "Asian Paints Nepal Pvt Ltd",
            "sector": "manufacturing-chemicals",
            "subsector": "paints",
            "ownership": "private",
            "parent": "Asian Paints Ltd (India)",
            "facilities": [
                {"name": "Hetauda Factory", "lat": 27.425, "lng": 85.027},
            ],
        },
        {
            "name": "Khanal Foods Pvt Ltd",
            "sector": "agriculture-processing",
            "subsector": "noodles",
            "ownership": "private",
            "parent": None,
            "facilities": [
                {"name": "Kathmandu Plant", "lat": 27.711, "lng": 85.342},
            ],
        },
    ]


def build_edgar_nepal_clipped(raw_csv: Path, poly_geojson: Path) -> dict:
    """Compute Nepal-clipped EDGAR 2024 CO2 total from gridded export.

    Mirrors the dedup-and-clip logic in /tmp/plot_nepal_edgar_v6.py:
      1. Read 0.1° grid cells (with possible duplicates from sector unrolling).
      2. Round (lat, lon) to 2 decimals and keep the MAX per cell.
      3. Mask to Nepal polygon (matplotlib.path.Path.contains_points).
      4. Sum surviving cells.

    The country_totals endpoint returns ~15.89 Mt for Nepal 2024 under the
    "India +" regional roll-up label. The polygon-clipped grid gives a
    Nepal-specific national total that's defensible without the EDGAR
    internal sector taxonomy leak.
    """
    import csv as _csv

    # 1. Read and dedup-by-max
    cells: dict[tuple[float, float], float] = {}
    raw_rows = 0
    with raw_csv.open() as f:
        r = _csv.DictReader(f)
        for row in r:
            raw_rows += 1
            lat = float(row["latitude"])
            lon = float(row["longitude"])
            v = float(row["co2_tonnes"])
            k = (round(lat, 2), round(lon, 2))
            if k not in cells or v > cells[k]:
                cells[k] = v

    # 2. Polygon mask via matplotlib.path
    from matplotlib.path import Path as MplPath
    import numpy as np

    geo = json.loads(poly_geojson.read_text())
    outer_ring = geo["coordinates"][0]
    poly_path = MplPath(np.array(outer_ring))

    points = np.array([(lon, lat) for (lat, lon) in cells.keys()])
    inside_mask = poly_path.contains_points(points)
    cell_items = list(cells.items())

    inside_cells: list[dict] = []
    total = 0.0
    sector_total_placeholder = 0.0
    for ((lat, lon), v), inside in zip(cell_items, inside_mask):
        if not inside:
            continue
        inside_cells.append({"lat": lat, "lng": lon, "co2Tonnes": round(v, 2)})
        total += v

    return {
        "source": "EDGAR v8.1 gridded CO2 emissions, 2024, polygon-clipped to Nepal",
        "license": "European Commission JRC, free for non-commercial use with attribution",
        "year": 2024,
        "country": "Nepal",
        "gridResolutionDegrees": 0.1,
        "rawRowCount": raw_rows,
        "rawCellCount": len(cells),
        "nepalCellCount": len(inside_cells),
        "nepalTotalTco2": round(total),
        "method": "Per-cell max across duplicate rows, then point-in-polygon mask with Nepal admin boundary",
        # We don't ship per-cell data to keep the JSON small; the total is the
        # only thing the demo needs as a benchmark.
    }


def build_ct_nepal_2024(raw_csv: Path) -> dict:
    """Process the Climate TRACE Nepal 2024 facility snapshot.

    Input columns: asset_id, lat, lon, sector, asset_type, co2e_2024
    Output: list of 213 facilities with tier classification.

    Tier cutoffs (per Jana ops analysis):
      - L (low):    < 10 kt CO2e / yr
      - M (medium): 10-100 kt CO2e / yr
      - H (high):   >= 100 kt CO2e / yr
    """
    import csv as _csv

    rows: list[dict] = []
    with raw_csv.open() as f:
        r = _csv.DictReader(f)
        for row in r:
            v = float(row.get("co2e_2024") or 0)
            tier = "L" if v < 10_000 else ("M" if v < 100_000 else "H")
            rows.append(
                {
                    "assetId": row["asset_id"],
                    "lat": float(row["lat"]),
                    "lng": float(row["lon"]),
                    "sector": row["sector"],
                    "assetType": row.get("asset_type") or None,
                    "co2e2024Tonnes": round(v),
                    "tier": tier,
                }
            )

    # Sort by emissions descending for stable ordering
    rows.sort(key=lambda r: -r["co2e2024Tonnes"])

    # Sector roll-ups
    from collections import Counter

    sector_totals: dict[str, float] = {}
    sector_counts: dict[str, int] = {}
    tier_counts: Counter[str] = Counter()
    sector_tier_counts: dict[str, Counter[str]] = {}
    for r in rows:
        s = r["sector"]
        sector_totals[s] = sector_totals.get(s, 0) + r["co2e2024Tonnes"]
        sector_counts[s] = sector_counts.get(s, 0) + 1
        tier_counts[r["tier"]] += 1
        sector_tier_counts.setdefault(s, Counter())[r["tier"]] += 1

    return {
        "source": "Climate TRACE v5.6 facility emissions for Nepal, 2024",
        "license": "CC BY 4.0 (Climate TRACE)",
        "year": 2024,
        "country": "Nepal",
        "totalFacilities": len(rows),
        "totalCo2eTonnes": round(sum(sector_totals.values())),
        "tierCounts": dict(tier_counts),
        "tierCutoffs": {"L_max": 10_000, "M_max": 100_000, "unit": "tCO2e / yr"},
        "sectorCounts": sector_counts,
        "sectorTotalsTco2e": {
            k: round(v) for k, v in sector_totals.items()
        },
        "sectorTierCounts": {
            s: dict(c) for s, c in sector_tier_counts.items()
        },
        "facilities": rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--gcct",
        default="/Users/willardmechem/Downloads/Global-Cement-and-Concrete-Tracker_July-2025.xlsx",
        help="Path to GCCT xlsx",
    )
    parser.add_argument(
        "--ownership-dir",
        default="/Users/willardmechem/Projects/repos/ownership",
        help="Path to GEM ownership CSV directory",
    )
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parent.parent / "data"),
        help="Output directory",
    )
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    gcct = Path(args.gcct)
    if not gcct.exists():
        print(f"GCCT file not found: {gcct}", file=sys.stderr)
        return 1

    cement = build_cement_plants(gcct)
    (out_dir / "cement-plants-npl.json").write_text(
        json.dumps(
            {
                "source": "Global Cement and Concrete Tracker, July 2025 release (V1)",
                "license": "CC BY 4.0 (Global Energy Monitor)",
                "country": "Nepal",
                "filter": "operating only",
                "count": len(cement),
                "plants": cement,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    print(f"Wrote {out_dir / 'cement-plants-npl.json'} ({len(cement)} plants)")

    hydro = hand_curated_hydropower()
    (out_dir / "hydropower-operators-npl.json").write_text(
        json.dumps(
            {
                "source": "Curated from NEA annual reports, IHA, and public filings",
                "country": "Nepal",
                "count": len(hydro),
                "operators": hydro,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    print(
        f"Wrote {out_dir / 'hydropower-operators-npl.json'} ({len(hydro)} operators)"
    )

    industrial = hand_curated_industrial()
    (out_dir / "industrial-entities-npl.json").write_text(
        json.dumps(
            {
                "source": "Curated from public filings, NEPSE listings, and Nepal Department of Industry registrations",
                "country": "Nepal",
                "count": len(industrial),
                "entities": industrial,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    print(
        f"Wrote {out_dir / 'industrial-entities-npl.json'} ({len(industrial)} entities)"
    )

    # Climate TRACE Nepal 2024 (if raw CSV is staged in data/)
    raw_ct = out_dir / "_raw_ct_emis_2024.csv"
    if raw_ct.exists():
        ct = build_ct_nepal_2024(raw_ct)
        (out_dir / "ct-nepal-2024.json").write_text(
            json.dumps(ct, indent=2, ensure_ascii=False)
        )
        print(
            f"Wrote {out_dir / 'ct-nepal-2024.json'} ({ct['totalFacilities']} facilities, "
            f"{ct['totalCo2eTonnes']:,} tCO2e)"
        )
    else:
        print(f"Skipping ct-nepal-2024.json — {raw_ct} not present")

    # EDGAR Nepal-clipped CO2 (if raw grid + polygon are staged in data/)
    raw_edgar = out_dir / "_raw_edgar_grid.csv"
    raw_poly = out_dir / "_raw_nepal_polygon.geojson"
    if raw_edgar.exists() and raw_poly.exists():
        edgar = build_edgar_nepal_clipped(raw_edgar, raw_poly)
        (out_dir / "edgar-nepal-2024.json").write_text(
            json.dumps(edgar, indent=2, ensure_ascii=False)
        )
        print(
            f"Wrote {out_dir / 'edgar-nepal-2024.json'} "
            f"({edgar['nepalCellCount']} cells inside Nepal, "
            f"{edgar['nepalTotalTco2']:,} tCO2)"
        )
    else:
        print(
            f"Skipping edgar-nepal-2024.json — needs _raw_edgar_grid.csv + "
            f"_raw_nepal_polygon.geojson in data/"
        )

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
