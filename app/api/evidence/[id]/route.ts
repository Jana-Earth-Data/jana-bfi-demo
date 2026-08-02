/**
 * DELETE /api/evidence/[id] — remove one attachment row, scoped to the
 *        current tenant. Any officer inside the tenant may delete —
 *        permissions are intentionally simple for the demo.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { assertOwnerOrRespond } from "@/lib/officers/loan-lock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }
  const tenant = await resolveCurrentTenant();

  // First confirm the row belongs to this tenant — a bare .delete().eq('id')
  // would silently no-op on a cross-tenant id rather than 403ing.
  const { data: existing, error: lookupErr } = await supabase
    .from("bfi_evidence_attachments")
    .select("id, bank_id, entity_type, entity_id")
    .eq("id", id)
    .limit(1);
  if (lookupErr) {
    return NextResponse.json(
      { error: `Evidence lookup failed: ${lookupErr.message}` },
      { status: 500 },
    );
  }
  if (!existing || existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing[0].bank_id !== tenant.id) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 },
    );
  }

  // Owner-only edit (P36). Resolve the loan this attachment ultimately
  // belongs to and reject non-owners. Same fail-open rules — we log
  // and allow when the lookup errors.
  const officer = await resolveCurrentOfficer();
  if (officer) {
    const row = existing[0] as {
      id: string;
      bank_id: string;
      entity_type: string;
      entity_id: string;
    };
    let attachedLoanId: string | null = null;
    if (row.entity_type === "esdd" || row.entity_type === "pf_screening") {
      attachedLoanId = row.entity_id;
    } else if (
      row.entity_type === "cap_item" ||
      row.entity_type === "covenant" ||
      row.entity_type === "monitoring_report"
    ) {
      const table =
        row.entity_type === "cap_item"
          ? "bfi_cap_items"
          : row.entity_type === "covenant"
            ? "bfi_covenants"
            : "bfi_monitoring_reports";
      try {
        const { data, error } = await supabase
          .from(table)
          .select("loan_id")
          .eq("bank_id", tenant.id)
          .eq("id", row.entity_id)
          .maybeSingle();
        if (error) {
          console.warn(
            `[evidence:delete] loan lookup for ${row.entity_type} failed (fail-open):`,
            error.message,
          );
        } else {
          attachedLoanId = (data?.loan_id as string | null) ?? null;
        }
      } catch (err) {
        console.warn(
          `[evidence:delete] loan lookup for ${row.entity_type} threw:`,
          err,
        );
      }
    }
    if (attachedLoanId) {
      const denied = await assertOwnerOrRespond(attachedLoanId, officer, tenant);
      if (denied) return denied;
    }
  }

  const { error } = await supabase
    .from("bfi_evidence_attachments")
    .delete()
    .eq("id", id)
    .eq("bank_id", tenant.id);
  if (error) {
    return NextResponse.json(
      { error: `Evidence delete failed: ${error.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, id });
}
