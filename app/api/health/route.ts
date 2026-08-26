/**
 * GET /api/health
 *
 * Lightweight health check endpoint for container orchestration (Docker
 * HEALTHCHECK, ECS health checks, load balancer target groups).
 *
 * Returns 200 with a JSON body indicating the service is running. Does not
 * check downstream dependencies (Supabase, etc.) — that would make the
 * health check fail on dependency outages, which is not what an
 * orchestrator should act on. Dependency health belongs in a separate
 * /api/health/ready endpoint if needed.
 *
 * Excluded from rate limiting by design — health checks can fire every
 * few seconds and must not be throttled.
 */

import { NextResponse } from "next/server";
import { isDemoBuild } from "@/lib/demo/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    demo: isDemoBuild(),
  });
}
