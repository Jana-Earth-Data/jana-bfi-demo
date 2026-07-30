/**
 * GET /api/pcaf/scores
 *
 * Returns the portfolio-wide PCAF data-quality score distribution plus
 * an optional per-loan scores array.  Scores are computed on-the-fly
 * from the in-memory portfolio (already cached), so this endpoint is
 * cheap and always reflects the current `pcafFor()` implementation
 * (which delegates to `lib/regulatory/pcaf/scoring.ts`).
 *
 * Query params:
 *   ?includeLoans=1   include a `loans` array with one row per loan.
 *                     Default is off — the distribution alone is small
 *                     enough to embed in dashboards; the per-loan array
 *                     is ~80k rows and only useful for auditor export.
 *
 * Response shape:
 *   {
 *     ok: true,
 *     asOfDate: "2025-10-31",
 *     distribution: [{ score: 1, loanCount, outstandingNpr, attributedCo2eTonnes }, ...],
 *     weightedScore: 3.2,
 *     methodologyMix: { "1a": n, "1b": n, "2a": n, "2b": n, "3a": n, "3b": n, "3c": n },
 *     assetClassMix: { "business-loans-unlisted-equity": n, ... },
 *     loans?: [{ loanId, borrowerId, score, option, assetClass, citation }, ...]
 *   }
 *
 * Cache:  handled naturally by the in-memory portfolio cache — no
 * additional layer needed.
 */

import { NextRequest, NextResponse } from "next/server";
import { getBfiDemoData } from "@/lib/api/bfi";
import type { PcafOption } from "@/lib/regulatory/pcaf/types";

export const dynamic = "force-dynamic";

type Score = 1 | 2 | 3 | 4 | 5;

type DistributionRow = {
  score: Score;
  loanCount: number;
  outstandingNpr: number;
  outstandingUsd: number;
  attributedCo2eTonnes: number;
};

type PerLoanRow = {
  loanId: string;
  borrowerId: string;
  score: Score;
  option: PcafOption | null;
  assetClass: string | null;
  citation: string | null;
  attributedCo2eTonnes: number;
};

export async function GET(req: NextRequest) {
  const includeLoans = req.nextUrl.searchParams.get("includeLoans") === "1";
  const data = await getBfiDemoData();

  const loanById = new Map(data.loans.map((l) => [l.id, l]));

  // Empty distribution seed.
  const distMap = new Map<Score, DistributionRow>();
  for (const s of [1, 2, 3, 4, 5] as Score[]) {
    distMap.set(s, {
      score: s,
      loanCount: 0,
      outstandingNpr: 0,
      outstandingUsd: 0,
      attributedCo2eTonnes: 0,
    });
  }

  const methodologyMix: Record<PcafOption, number> = {
    "1a": 0,
    "1b": 0,
    "2a": 0,
    "2b": 0,
    "3a": 0,
    "3b": 0,
    "3c": 0,
  };
  const assetClassMix = new Map<string, number>();

  const loans: PerLoanRow[] = includeLoans ? [] : [];
  let weightedSum = 0;
  let weightedDenom = 0;

  for (const a of data.attributions) {
    const s = a.dataQualityScore as Score;
    const loan = loanById.get(a.loanId);
    if (!loan) continue;

    const row = distMap.get(s)!;
    row.loanCount += 1;
    row.outstandingNpr += loan.outstandingNpr;
    row.outstandingUsd += loan.outstandingUsd;
    row.attributedCo2eTonnes += a.attributedCo2eTonnes;

    if (a.pcafOption) methodologyMix[a.pcafOption] += 1;
    if (a.pcafAssetClass) {
      assetClassMix.set(
        a.pcafAssetClass,
        (assetClassMix.get(a.pcafAssetClass) ?? 0) + 1,
      );
    }

    if (a.attributedCo2eTonnes > 0) {
      weightedSum += s * a.attributedCo2eTonnes;
      weightedDenom += a.attributedCo2eTonnes;
    }

    if (includeLoans) {
      loans.push({
        loanId: a.loanId,
        borrowerId: a.borrowerId,
        score: s,
        option: a.pcafOption ?? null,
        assetClass: a.pcafAssetClass ?? null,
        citation: a.pcafCitation ?? null,
        attributedCo2eTonnes: a.attributedCo2eTonnes,
      });
    }
  }

  const weightedScore =
    weightedDenom > 0
      ? Math.round((weightedSum / weightedDenom) * 10) / 10
      : 0;

  return NextResponse.json({
    ok: true,
    asOfDate: data.meta.asOfDate ?? null,
    isMock: data.meta.isMock,
    distribution: Array.from(distMap.values()).map((r) => ({
      ...r,
      outstandingNpr: Math.round(r.outstandingNpr),
      outstandingUsd: Math.round(r.outstandingUsd),
      attributedCo2eTonnes: Math.round(r.attributedCo2eTonnes),
    })),
    weightedScore,
    methodologyMix,
    assetClassMix: Object.fromEntries(assetClassMix.entries()),
    ...(includeLoans ? { loans } : {}),
  });
}
