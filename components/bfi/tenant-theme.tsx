import type { ReactNode } from "react";
import type { TenantConfig } from "@/lib/tenants";

/**
 * Emit the current tenant's brand palette as CSS custom properties on a
 * wrapper element. Any child component can then reach the tenant's colors
 * via Tailwind's arbitrary-value syntax:
 *
 *   className="bg-[color:var(--brand-primary)] text-[color:var(--brand-fg)]"
 *
 * or standard CSS:
 *
 *   style={{ color: "var(--brand-primary)" }}
 *
 * The CSS variables are the ONE runtime handoff between the tenant module
 * (server: reads the cookie, resolves the TenantConfig) and the components
 * (client: paints with the resolved colors). Because we emit them on the
 * layout tree rather than mutating :root at runtime, we get correct SSR
 * output for every tenant with zero client-side flash-of-wrong-color.
 *
 * Variables:
 *   --brand-primary        : main brand hex (buttons, active nav, KPI values)
 *   --brand-primary-strong : slightly darker for hover states
 *   --brand-primary-soft   : 10 percent tint for backgrounds and chips
 *   --brand-accent         : secondary accent (dividers, subtle callouts)
 *   --brand-fg             : text color that reads on --brand-primary bg
 *
 * The soft/strong shades are derived from the primary hex via a tiny
 * bit-shift heuristic so we don't have to store four hexes per tenant.
 */

function darken(hex: string, amount: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((int >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((int >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((int & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function softRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 0xff;
  const g = (int >> 8) & 0xff;
  const b = int & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function TenantThemeProvider({
  tenant,
  children,
}: {
  tenant: TenantConfig;
  children: ReactNode;
}) {
  const primary = tenant.branding.primaryColorHex;
  const accent = tenant.branding.accentColorHex;
  const strong = darken(primary, 0.12);
  const soft = softRgba(primary, 0.15);

  const style = {
    "--brand-primary": primary,
    "--brand-primary-strong": strong,
    "--brand-primary-soft": soft,
    "--brand-accent": accent,
    "--brand-fg": "#FFFFFF",
  } as React.CSSProperties;

  return (
    <div style={style} className="contents">
      {children}
    </div>
  );
}
