/**
 * Demo provider implementation — the only module that reaches the fabricated
 * data directly.
 *
 * Loaded exclusively via the dynamic import in ./provider.ts, so a live build
 * never pulls it or anything it depends on into the bundle. Keeping this file
 * thin is deliberate: it is a wiring layer, and the less logic it holds the
 * less there is to accidentally depend on from outside.
 *
 * The synthesizer now lives at lib/demo/portfolio.ts, alongside this file.
 * Routing every consumer through this seam first meant the move touched one
 * import rather than five.
 */

import {
  getPortfolio,
  invalidatePortfolioCache,
} from "@/lib/demo/portfolio";
import {
  PCAF_NAME_FIXTURES_VERIFIED,
  PCAF_NAME_FIXTURES_UNVERIFIED,
  synthAirQuality,
} from "./fixtures";
import type { DemoProvider } from "./provider";

export const demoProvider: DemoProvider = {
  getPortfolio,
  invalidatePortfolioCache,
  pcafNameFixtures: () => ({
    verified: PCAF_NAME_FIXTURES_VERIFIED,
    unverified: PCAF_NAME_FIXTURES_UNVERIFIED,
  }),
  synthAirQuality,
};
