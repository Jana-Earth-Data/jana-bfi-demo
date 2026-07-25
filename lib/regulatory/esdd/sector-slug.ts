/**
 * Map a free-form NRB sector label (borrower.nrbSector) to the stable
 * slug used by ANNEX5_SECTOR_SUPPLEMENTS in annex5-questions.ts.
 *
 * Kept in its own module so the wizard, the drawer, the officer-queue
 * API, the manager-queue API and the scoring engine all agree on how
 * a borrower's sector maps to its supplement.
 *
 * Returns undefined when no sector supplement exists for the label.
 */
export function sectorSlugFor(nrbSector: string): string | undefined {
  const s = nrbSector.toLowerCase();
  if (s.includes("hydropower")) return "hydropower";
  if (s.includes("cement")) return "cement";
  if (s.includes("textile")) return "textiles";
  if (s.includes("steel")) return "steel";
  if (s.includes("chemical")) return "chemicals";
  if (s.includes("brick")) return "brick";
  if (s.includes("agriculture")) return "agriculture";
  return undefined;
}
