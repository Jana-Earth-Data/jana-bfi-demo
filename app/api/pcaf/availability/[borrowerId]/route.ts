/**
 * PCAF Data Availability — per-borrower officer confirmation / override.
 *
 * The demo default is to *infer* the four PCAF §5 decision-tree flags
 * (`inferPcafAvailability` — Climate TRACE match → physical_activity,
 * publiclyListed → revenue, name-substring match → publishes_verified /
 * unverified).  This route lets an officer confirm or override that
 * inference after reviewing the borrower's actual annual report /
 * ISO 14064 assurance statement — the whole point of the P24 collection
 * UI.
 *
 * Endpoints:
 *
 *   GET  /api/pcaf/availability/[borrowerId]
 *     Returns:
 *       inferredFlags  — from the borrower catalog (never absent).
 *       savedFlags     — from bfi_pcaf_availability (null when no row).
 *       resolvedFlags  — `resolvePcafAvailability(inferred, saved)` merge.
 *       evidence       — per-flag { flagKey: evidence string | null }.
 *       notes          — analyst free-form.
 *       computed       — full PcafComputationResult from the resolved flags
 *                        (so the workbench can display the fresh score
 *                        without a separate refetch of /api/pcaf/scores).
 *       autoInferenceSources — the borrower fields that drove the auto
 *                        suggestion (dataTier, publiclyListed, evSource,
 *                        facilityCount) so the officer can rationalise
 *                        their override.
 *
 *   POST /api/pcaf/availability/[borrowerId]
 *     Body: {
 *       flags: PcafDataAvailability,
 *       evidence: Record<string, string | null>,   // per-flag evidence
 *       notes?: string | null,
 *       loanCategory?: LoanCategory,               // for citation compute
 *     }
 *     Upserts on (bank_id, borrower_id).  Evidence is JSON-stringified
 *     into the single `evidence_note` text column (schema keeps one
 *     column — we round-trip a small JSON envelope so the analyst
 *     preserves per-flag detail without a schema change).
 *
 * Table: scripts/supabase-pcaf-availability.sql
 *   Columns are 1:1 with `PcafDataAvailability`, plus `evidence_note`
 *   (JSON envelope: `{ notes: string|null, perFlag: Record<string,string> }`)
 *   and `pcaf_citation` for the auditor-friendly summary of the last
 *   compute.
 */

import { NextResponse } from "next/server";
import { getBfiDemoData } from "@/lib/api/bfi";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import {
  assetClassForLoanCategory,
  computePcafScore,
  inferPcafAvailability,
  resolvePcafAvailability,
} from "@/lib/regulatory/pcaf/scoring";
import type {
  PcafDataAvailability,
  PcafComputationResult,
} from "@/lib/regulatory/pcaf/types";
import type { Borrower, Loan, LoanCategory } from "@/lib/types/bfi";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ borrowerId: string }> };

const FLAG_KEYS: Array<keyof PcafDataAvailability> = [
  "borrower_publishes_verified",
  "borrower_publishes_unverified",
  "energy_consumption_data_available",
  "physical_activity_data_available",
  "revenue_data_available",
  "sector_average_only",
  "out_of_scope",
];

type SavedRow = {
  borrower_publishes_verified: boolean;
  borrower_publishes_unverified: boolean;
  energy_consumption_data_available: boolean;
  physical_activity_data_available: boolean;
  revenue_data_available: boolean;
  sector_average_only: boolean;
  out_of_scope: boolean;
  evidence_note: string | null;
  pcaf_citation: string | null;
  captured_at: string | null;
  captured_by: string | null;
  updated_at: string | null;
};

type EvidenceEnvelope = {
  notes: string | null;
  perFlag: Record<string, string>;
};

function parseEvidence(raw: string | null): EvidenceEnvelope {
  if (!raw) return { notes: null, perFlag: {} };
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "perFlag" in parsed
    ) {
      return {
        notes: typeof parsed.notes === "string" ? parsed.notes : null,
        perFlag:
          parsed.perFlag && typeof parsed.perFlag === "object"
            ? (parsed.perFlag as Record<string, string>)
            : {},
      };
    }
  } catch {
    // Legacy value — a plain free-form analyst note.
  }
  return { notes: raw, perFlag: {} };
}

function pickFlags(row: SavedRow): PcafDataAvailability {
  return {
    borrower_publishes_verified: row.borrower_publishes_verified,
    borrower_publishes_unverified: row.borrower_publishes_unverified,
    energy_consumption_data_available: row.energy_consumption_data_available,
    physical_activity_data_available: row.physical_activity_data_available,
    revenue_data_available: row.revenue_data_available,
    sector_average_only: row.sector_average_only,
    out_of_scope: row.out_of_scope,
  };
}

function findLoanForBorrower(
  loans: Loan[],
  borrowerId: string,
): Loan | undefined {
  // Prefer commercial / project-finance / corporate exposures — those are the
  // rows that drive the visible workbench PCAF panel. Fall through to any
  // loan so the endpoint stays useful for retail borrowers too.
  return (
    loans.find(
      (l) =>
        l.borrowerId === borrowerId &&
        (l.category === "commercial-project-finance" ||
          l.category === "corporate-project-finance" ||
          l.category === "corporate-syndicated" ||
          l.category === "commercial-term-loan"),
    ) ?? loans.find((l) => l.borrowerId === borrowerId)
  );
}

function autoInferenceSources(borrower: Borrower) {
  return {
    dataTier: borrower.dataTier ?? null,
    publiclyListed: borrower.publiclyListed ?? false,
    evSource: borrower.evSource,
    facilityCount: borrower.facilities.length,
    nrbSector: borrower.nrbSector,
  };
}

function buildComputed(
  loan: Loan | undefined,
  borrower: Borrower,
  flags: PcafDataAvailability,
): PcafComputationResult | null {
  if (!loan) return null;
  const assetClass = assetClassForLoanCategory(loan.category);
  return computePcafScore(loan, borrower, null, flags, assetClass);
}

async function loadSavedRow(
  bankId: string,
  borrowerId: string,
): Promise<SavedRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("bfi_pcaf_availability")
    .select(
      "borrower_publishes_verified, borrower_publishes_unverified, energy_consumption_data_available, physical_activity_data_available, revenue_data_available, sector_average_only, out_of_scope, evidence_note, pcaf_citation, captured_at, captured_by, updated_at",
    )
    .eq("bank_id", bankId)
    .eq("borrower_id", borrowerId)
    .limit(1);
  if (error) {
    console.warn("[pcaf/availability] load failed:", error.message);
    return null;
  }
  return (data?.[0] as SavedRow | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(_req: Request, { params }: Params) {
  const { borrowerId } = await params;
  if (!borrowerId) {
    return NextResponse.json(
      { error: "borrowerId is required" },
      { status: 400 },
    );
  }

  const data = await getBfiDemoData();
  const borrower = data.borrowers.find((b) => b.id === borrowerId);
  if (!borrower) {
    return NextResponse.json(
      { error: `Borrower ${borrowerId} not found` },
      { status: 404 },
    );
  }

  const loan = findLoanForBorrower(data.loans, borrowerId);
  const inferredFlags = inferPcafAvailability(borrower, loan?.category);

  const tenant = await resolveCurrentTenant();
  const savedRow = await loadSavedRow(tenant.id, borrowerId);
  const savedFlags = savedRow ? pickFlags(savedRow) : null;
  const evidenceEnvelope = savedRow
    ? parseEvidence(savedRow.evidence_note)
    : { notes: null, perFlag: {} as Record<string, string> };

  const resolvedFlags = resolvePcafAvailability(inferredFlags, savedFlags);
  const computed = buildComputed(loan, borrower, resolvedFlags);

  return NextResponse.json({
    ok: true,
    borrowerId,
    borrower: {
      id: borrower.id,
      name: borrower.name,
      nrbSector: borrower.nrbSector,
    },
    loanId: loan?.id ?? null,
    loanCategory: loan?.category ?? null,
    inferredFlags,
    savedFlags,
    resolvedFlags,
    evidence: evidenceEnvelope.perFlag,
    notes: evidenceEnvelope.notes,
    computed,
    autoInferenceSources: autoInferenceSources(borrower),
    capturedAt: savedRow?.captured_at ?? null,
    capturedBy: savedRow?.captured_by ?? null,
    updatedAt: savedRow?.updated_at ?? null,
    citation:
      "PCAF Part A 3rd Edition §5 · Data Quality decision tree (analyst confirmation)",
  });
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(request: Request, { params }: Params) {
  const { borrowerId } = await params;
  if (!borrowerId) {
    return NextResponse.json(
      { error: "borrowerId is required" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }

  let body: {
    flags?: Partial<PcafDataAvailability>;
    evidence?: Record<string, string | null>;
    notes?: string | null;
    loanCategory?: LoanCategory;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const flagsIn = body.flags ?? {};
  const evidenceIn = body.evidence ?? {};

  const data = await getBfiDemoData();
  const borrower = data.borrowers.find((b) => b.id === borrowerId);
  if (!borrower) {
    return NextResponse.json(
      { error: `Borrower ${borrowerId} not found` },
      { status: 404 },
    );
  }
  const loan = findLoanForBorrower(data.loans, borrowerId);
  const loanCategory = body.loanCategory ?? loan?.category;

  const inferredFlags = inferPcafAvailability(borrower, loanCategory);
  const savedFlags: PcafDataAvailability = {
    borrower_publishes_verified: !!flagsIn.borrower_publishes_verified,
    borrower_publishes_unverified: !!flagsIn.borrower_publishes_unverified,
    energy_consumption_data_available: !!flagsIn.energy_consumption_data_available,
    physical_activity_data_available: !!flagsIn.physical_activity_data_available,
    revenue_data_available: !!flagsIn.revenue_data_available,
    sector_average_only: flagsIn.sector_average_only !== false,
    out_of_scope: !!flagsIn.out_of_scope,
  };
  const resolvedFlags = resolvePcafAvailability(inferredFlags, savedFlags);
  const computed = buildComputed(loan, borrower, resolvedFlags);

  const tenant = await resolveCurrentTenant();
  const officer = await resolveCurrentOfficer();

  // Trim per-flag evidence to the recognised keys only — reject stray keys
  // rather than persisting them; the columns are typed.
  const cleanedEvidence: Record<string, string> = {};
  for (const key of FLAG_KEYS) {
    const v = evidenceIn[key];
    if (typeof v === "string" && v.trim().length > 0) {
      cleanedEvidence[key] = v.trim();
    }
  }
  const notes = body.notes?.trim() || null;
  const evidenceEnvelope: EvidenceEnvelope = {
    notes,
    perFlag: cleanedEvidence,
  };

  const upsertRow = {
    bank_id: tenant.id,
    borrower_id: borrowerId,
    borrower_publishes_verified: savedFlags.borrower_publishes_verified,
    borrower_publishes_unverified: savedFlags.borrower_publishes_unverified,
    energy_consumption_data_available:
      savedFlags.energy_consumption_data_available,
    physical_activity_data_available:
      savedFlags.physical_activity_data_available,
    revenue_data_available: savedFlags.revenue_data_available,
    sector_average_only: savedFlags.sector_average_only,
    out_of_scope: savedFlags.out_of_scope,
    evidence_note: JSON.stringify(evidenceEnvelope),
    pcaf_citation: computed?.citation ?? null,
    captured_by: officer?.id ?? null,
    captured_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("bfi_pcaf_availability")
    .upsert(upsertRow, { onConflict: "bank_id,borrower_id" });
  if (error) {
    return NextResponse.json(
      { error: `Upsert failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    borrowerId,
    inferredFlags,
    savedFlags,
    resolvedFlags,
    evidence: cleanedEvidence,
    notes,
    computed,
    autoInferenceSources: autoInferenceSources(borrower),
    officer: officer
      ? { id: officer.id, name: officer.name, role: officer.role }
      : null,
    citation:
      "PCAF Part A 3rd Edition §5 · Data Quality decision tree (analyst confirmation)",
  });
}
