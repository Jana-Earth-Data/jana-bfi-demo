/**
 * Demo mode — is the demo layer switched ON right now?
 *
 * Distinct from isDemoBuild() in ./provider.ts, and the difference matters.
 *
 *   isDemoBuild()  — does this artifact CONTAIN the demo layer? Build-time,
 *                    immutable, decided by JANA_DEMO at compile.
 *   isDemoMode()   — is it currently ACTIVE? Runtime, togglable, but only
 *                    inside a build that contains it.
 *
 * A live build has no demo code compiled in, so there is nothing for a
 * runtime toggle to enable. The toggle exists for demo builds, so you can
 * show the clean empty product mid-conversation without rebuilding.
 *
 * The rule
 * --------
 *   effective = isDemoBuild() && (cookie ?? true)
 *
 * The asymmetry is deliberate and load-bearing. You can always turn demo OFF.
 * You can only turn it ON in a build that shipped the demo layer. A cookie
 * cannot conjure fabricated data into a live deployment, because the code to
 * fabricate it is not in the bundle -- the switch is a convenience, not a
 * security boundary, and it is arranged so that misusing it fails safe.
 *
 * Default ON in a demo build: someone who deliberately built with JANA_DEMO=1
 * wants the demo. Making them also flip a cookie would be a papercut with no
 * safety benefit, since the artifact is already demo-only.
 */

import { cookies } from "next/headers";
import { isDemoBuild } from "./provider";

export const DEMO_MODE_COOKIE = "jana_demo_mode";

/**
 * Whether the demo layer is active for this request.
 *
 * Server-only: reads the cookie jar. Client components receive the resolved
 * value as a prop rather than re-deriving it, so there is one answer per
 * render and no chance of the banner and the data disagreeing.
 */
export async function isDemoMode(): Promise<boolean> {
  if (!isDemoBuild()) return false;
  const jar = await cookies();
  const raw = jar.get(DEMO_MODE_COOKIE)?.value;
  // Absent means on. Only an explicit "off" disables it.
  return raw !== "off";
}

/**
 * Whether to render the demo controls at all.
 *
 * True for any demo build, including when demo mode is toggled off -- the
 * menu is how you toggle it back on. A live build returns false and the
 * controls are never rendered.
 */
export function showDemoControls(): boolean {
  return isDemoBuild();
}
