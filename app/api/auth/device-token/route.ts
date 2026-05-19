import { NextRequest, NextResponse } from "next/server";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? "";

export async function POST(req: NextRequest) {
  if (!AUTH_URL) {
    return NextResponse.json(
      { error: "AUTH_URL not configured" },
      { status: 500 }
    );
  }

  const body = await req.json();

  const res = await fetch(`${AUTH_URL}/api/auth/device-token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
