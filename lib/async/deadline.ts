/**
 * withDeadline — race a promise against a wall-clock deadline.
 *
 * Server components and API routes here fold optional enhancements (officer
 * PCAF overlays, live-emissions overlays) into a base payload that is always
 * available on its own. Those enhancements read from Supabase or upstream
 * APIs, and a stalled read must never hold the whole render hostage — we would
 * rather ship the base payload a little stale than block first paint for tens
 * of seconds. (See app/page.tsx: a Supabase read was observed wedging a
 * force-dynamic render for ~73s on Vercel.)
 *
 * On timeout this resolves to `fallback` (default `null`) instead of
 * rejecting, so callers can treat "did not finish in time" the same as "no
 * data" without a try/catch. A rejection from the wrapped promise is also
 * swallowed to `fallback` for the same reason: an overlay that errors should
 * degrade to the base payload, not crash the page.
 *
 * NOTE: the underlying work is not cancelled — JavaScript promises are not
 * cancellable. The wrapped promise keeps running to completion in the
 * background; we simply stop waiting for it. Cancellation, where it matters,
 * belongs at the I/O layer (see the AbortSignal-based fetch timeout in
 * lib/data/supabase.ts), not here.
 */
export function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null>;
export function withDeadline<T, F>(
  promise: Promise<T>,
  ms: number,
  fallback: F,
): Promise<T | F>;
export function withDeadline<T, F = null>(
  promise: Promise<T>,
  ms: number,
  fallback: F = null as F,
): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<F>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });

  return Promise.race([
    promise.then(
      (value) => value,
      // Degrade an errored overlay to the fallback rather than propagating.
      () => fallback,
    ),
    deadline,
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
