/**
 * POST /api/demo/mode  { on: boolean }
 *
 * Toggles demo mode for this browser session.
 *
 * Refuses outright in a live build. That is not defence in depth so much as
 * honesty: a live build has no demo layer compiled in, so switching the
 * cookie would change a label and nothing else. Better to say the capability
 * is absent than to accept the request and appear to have done something.
 *
 * The cookie only ever narrows what is shown. It cannot introduce fabricated
 * data into a build that does not contain any -- see lib/demo/mode.ts for why
 * the asymmetry is arranged that way.
 */

import { NextRequest, NextResponse } from "next/server";
import { DEMO_MODE_COOKIE } from "@/lib/demo/mode";
import { isDemoBuild } from "@/lib/demo/provider";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isDemoBuild()) {
    return NextResponse.json(
      {
        error:
          "This build has no demo layer, so there is nothing to toggle. " +
          "Rebuild with JANA_DEMO=1 if you need the demo.",
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const { on } = (body ?? {}) as { on?: boolean };
  if (typeof on !== "boolean") {
    return NextResponse.json(
      { error: "Body must be { on: boolean }." },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ ok: true, demoMode: on });
  res.cookies.set(DEMO_MODE_COOKIE, on ? "on" : "off", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    // Session-scoped on purpose. Demo mode should not silently persist for
    // weeks after a demo; closing the browser returns the build to its
    // default, which for a demo build is on.
  });
  return res;
}
