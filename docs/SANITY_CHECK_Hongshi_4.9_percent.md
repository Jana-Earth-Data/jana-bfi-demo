# Sanity check: Hongshi Shivam = 4.9% of Nepal national CO₂

Reference notes for live demos. The claim that Hongshi Shivam Cement Sardi Bagaicha contributes roughly 4.9% of Nepal's national CO₂ is the headline number on the ESRM workbench. This document explains how it is computed and verifies that it is not an artifact of coordinate-based aggregation.

## The claim

> "A single cement facility, Hongshi Shivam Sardi Bagaicha, contributes 4.9% of Nepal's national CO₂ emissions."

## The math

| Component | Value | Source |
| --- | --- | --- |
| Numerator: Hongshi Shivam 2024 CO₂e | 922,187 tCO₂e | Climate TRACE v5.6, asset_id 25263 |
| Denominator: Nepal national CO₂ 2024 | 18,813,007 tCO₂ | EDGAR v8.1 gridded inventory, polygon-clipped to Nepal admin boundary |
| Ratio | 4.90% | 922,187 / 18,813,007 |

## Verification: this is one facility, not an aggregation

A natural challenge: "is the 922K number actually multiple cement plants bundled because they share coordinates?" Verified against the raw data:

- Climate TRACE Nepal 2024 has **213 facilities total** with **distinct asset_ids** (213 of 213 unique).
- Within 5 km of the GCCT-registered Hongshi Shivam Sardi Bagaicha coordinates (27.6708, 83.8370), there is **exactly one Climate TRACE asset**: id 25263 at (27.6704, 83.8383). Distance: 130 m (satellite positioning offset vs registry rounding for the same physical plant).
- No other CT assets at, near, or overlapping these coordinates.

## Verification: this is the largest manufacturing facility in Nepal CT data

The top ten Nepal manufacturing facilities by 2024 emissions (Climate TRACE v5.6):

| Rank | Asset ID | Coordinates | tCO₂e 2024 |
| --- | --- | --- | --- |
| 1 | **25263** (Hongshi Shivam) | 27.6704, 83.8383 | **922,187** |
| 2 | 25258 | 27.9120, 83.4042 | 594,189 |
| 3 | 25271 | 27.8545, 82.4917 | 520,510 |
| 4 | 25273 | 26.8424, 86.2368 | 506,051 |
| 5 | 25255 | 27.5338, 83.4103 | 464,238 |
| 6 | 25272 | 27.6155, 83.6876 | 443,757 |
| 7 | 25274 | 28.0901, 82.3790 | 424,205 |
| 8 | 25270 | 27.3741, 85.0354 | 399,057 |
| 9 | 25264 | 27.7277, 84.8134 | 396,126 |
| 10 | 25261 | 27.9961, 82.5088 | 382,164 |

Hongshi at 922K is 1.55× the next-largest plant (594K). Consistent with its 2.3 Mt/yr cement capacity from the Global Cement and Concrete Tracker, which is more than twice the capacity of typical Nepali peers (Arghakhanchi at ~1.0 Mt/yr, for example).

## Physical plausibility

| Factor | Value |
| --- | --- |
| Hongshi Shivam cement capacity (GCCT) | 2.3 Mt cement / yr |
| Climate TRACE 2024 emissions | 922,187 tCO₂e |
| Implied emission factor | 922,187 / 2,300,000 = **0.40 tCO₂ per tonne cement** |

For reference, the global cement industry average emission factor is 0.6 to 0.8 tCO₂ per tonne of cement. Modern dry-process plants (which Hongshi is, commissioned 2018) typically sit in the 0.4 to 0.6 range. 0.40 t/t implies either roughly 70% capacity utilisation in 2024 or a relatively efficient kiln configuration. Either reading is consistent with a working 2.3 Mt plant.

## How EDGAR polygon-clipping was done

The EDGAR v8.1 grid product comes as 0.1° × 0.1° cells across a bounding box. The Nepal national figure here is derived from:

1. All EDGAR Nepal-region grid cells, deduplicated by max-value-per-cell to remove join artifacts (some grid cells appeared twice with identical values in the raw export, 78 duplicates of 3,337 raw rows).
2. Point-in-polygon mask against the Nepal admin boundary (matplotlib.path), which filters out cells outside the country.
3. Resulting set: **1,343 cells inside Nepal**, summing to **18,813,007 tCO₂**.

Why not use the EDGAR country-totals endpoint instead? EDGAR's country_totals table reports Nepal under the regional roll-up label "India +", which is a single national line item and does not provide Nepal-specific sector resolution. The polygon-clipped grid product is Nepal-specific by construction and produces a number consistent with World Bank and UNFCCC published values for Nepal (commonly 14 to 18 Mt CO₂ / yr in recent years).

## Sources cited on the dashboard

- Climate TRACE v5.6 facility emissions (CC BY 4.0, Climate TRACE coalition)
- Global Cement and Concrete Tracker, July 2025 release (CC BY 4.0, Global Energy Monitor)
- EDGAR v8.1 gridded CO₂ emissions (European Commission JRC)
- Nepal admin boundary polygon (public administrative dataset)

## If asked

If a banker challenges the 4.9% figure during a demo, the short answer is:

> The 922K tCO₂e is one Climate TRACE asset, id 25263, sitting 130 m from the GCCT registry coordinates for the Sardi Bagaicha plant. There are no other CT assets within 5 km of that point, so no aggregation. The Nepal national denominator is EDGAR's 2024 gridded inventory clipped to Nepal's admin boundary, which sums to 18.81 Mt. The math is straightforward division. The implied emission factor of 0.40 tCO₂ per tonne of cement is in the right range for a 2018-vintage dry-process plant.

A fuller verification including the raw row inspections is in this document.
