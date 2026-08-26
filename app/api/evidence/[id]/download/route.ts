/**
 * GET /api/evidence/[id]/download — stream one attachment's raw bytes.
 *
 * Headers set:
 *   Content-Type: <mime_type or application/octet-stream>
 *   Content-Disposition: attachment; filename="<escaped filename>"
 *   Content-Length: <size>
 *
 * Tenant-scoped: cross-tenant requests 404.
 */

import { NextRequest, NextResponse } from "next/server";

import { resolveCurrentTenant } from "@/lib/tenants";
import { getCaptureClient } from "@/lib/data/capture-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = await getCaptureClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }
  const tenant = await resolveCurrentTenant();

  const { data, error } = await supabase
    .from("bfi_evidence_attachments")
    .select("bank_id, filename, mime_type, size_bytes, data")
    .eq("id", id)
    .limit(1);
  if (error) {
    return NextResponse.json(
      { error: `Evidence lookup failed: ${error.message}` },
      { status: 500 },
    );
  }
  if (!data || data.length === 0 || data[0].bank_id !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = data[0] as {
    filename: string;
    mime_type: string | null;
    size_bytes: number;
    data: unknown;
  };

  // Supabase serves bytea as a hex string prefixed with '\x' by default.
  // Convert that back to a Node Buffer. If it's already a Buffer / Uint8Array
  // (some client versions do the decode automatically), pass through.
  let bytes: Buffer;
  const raw = row.data;
  if (Buffer.isBuffer(raw)) {
    bytes = raw;
  } else if (raw instanceof Uint8Array) {
    bytes = Buffer.from(raw);
  } else if (typeof raw === "string") {
    if (raw.startsWith("\\x")) {
      bytes = Buffer.from(raw.slice(2), "hex");
    } else {
      // Fall back to base64 — this branch covers a future migration
      // to a text column if bytea ever becomes friction.
      bytes = Buffer.from(raw, "base64");
    }
  } else {
    return NextResponse.json(
      { error: "Unable to decode evidence payload." },
      { status: 500 },
    );
  }

  const mime = row.mime_type || "application/octet-stream";
  // Quote-escape the filename for Content-Disposition — backslash-escape
  // any embedded double quotes.
  const safeName = row.filename.replace(/"/g, '\\"');

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": bytes.byteLength.toString(),
      "Cache-Control": "private, no-store",
    },
  });
}
