/**
 * Capture proposal screenshots from a running instance of the demo.
 *
 * Produces the eight core screens referenced in Appendix A of the Laxmi
 * Sunrise partnership proposal, plus a couple of optional extras.
 *
 * Screenshots are element-scoped wherever a stable `data-tour` attribute
 * exists, so a CSS refactor will not silently change what is captured.
 * Where a full-page view is more informative than a single panel, the
 * script captures the viewport instead.
 *
 * PREREQUISITES
 *   1. The app must be running and seeded. Either:
 *        docker compose up -d --build          (http://localhost:3001)
 *        docker compose -f docker-compose.offline.yml up -d --build
 *                                              (http://localhost:3002)
 *      then seed in this order:
 *        curl -X POST "<base>/api/admin/seed-officers?token=$SEED_ADMIN_TOKEN"
 *        curl -X POST "<base>/api/admin/seed?token=$SEED_ADMIN_TOKEN"
 *        curl -X POST "<base>/api/admin/seed-demo-data?token=$SEED_ADMIN_TOKEN"
 *
 *   2. Playwright installed (dev-only, not shipped):
 *        npm install --save-dev playwright
 *        npx playwright install chromium
 *
 * USAGE
 *   npx tsx scripts/capture-screenshots.ts
 *   npx tsx scripts/capture-screenshots.ts --base http://localhost:3002
 *   npx tsx scripts/capture-screenshots.ts --tenant default
 *   npx tsx scripts/capture-screenshots.ts --out docs/proposal-screenshots
 *
 * OUTPUT
 *   docs/proposal-screenshots/01-my-work.png ... 08-nfrs-disclosure.png
 *   plus a manifest.md listing each file with its caption, ready to paste
 *   into Appendix A.
 */
import { chromium, type Browser, type Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
function arg(flag: string, fallback: string): string {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

const BASE = arg("--base", "http://localhost:3001").replace(/\/$/, "");
const TENANT = arg("--tenant", "laxmi_sunrise");
const OUT_DIR = path.resolve(arg("--out", "docs/proposal-screenshots"));

/** Laxmi's ESG officer. Owns the seeded demo loans, so the workbench renders
 *  editable rather than behind the P36 read-only lock. */
const OFFICER_ID = TENANT === "laxmi_sunrise" ? "off-laxmi-02" : "off-default-02";

/** Seeded loans. Cement carries the escalated ESDD + CAP items; hydro is the
 *  project-finance case that unlocks the Annex 5b wizard. */
const CEMENT_LOAN = "L-0079959";
const HYDRO_LOAN = "L-0080028";

/** 2x scale keeps text crisp when the PNG is placed in a print PDF. */
const VIEWPORT = { width: 1600, height: 1000 };
const SCALE = 2;

type Shot = {
  file: string;
  caption: string;
  /** Where to navigate before capturing. */
  url: string;
  /** Element to scope the capture to. Omit for a viewport capture. */
  selector?: string;
  /** Run before capturing: clicks, waits, tab switches. */
  prepare?: (page: Page) => Promise<void>;
  /** Clip the capture if height/width exceeds this. Keeps very long
   *  wizards from rendering as an unreadable strip in the PDF. */
  maxAspect?: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// A fixed delay races any fetch slower than itself. The manager queue hits
// Supabase in ap-south-1, which regularly outruns 900ms -- when it does, the
// counters render their empty state ("0 assigned / 21 unassigned / 0
// screening complete") while the per-loan detail beside them has already
// resolved, and the screenshot captures a page contradicting itself.
// Wait for the network to go quiet first, then apply the delay for paint.
const settle = async (page: Page, ms = 900) => {
  try {
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  } catch {
    // Some views hold a long-poll open; fall through to the fixed delay
    // rather than failing the capture.
  }
  await page.waitForTimeout(ms);
};

/** Click a tab in the main dashboard strip by its visible label.
 *
 *  MUST be scoped to [data-tour='tab-strip']. The header above it carries a
 *  tour selector whose buttons share names with the tabs ("Manager", "NFRS"),
 *  and an unscoped match hits the tour button and starts a guided tour, which
 *  dims the page and overlays a callout. */
async function openTab(page: Page, label: string) {
  const strip = page.locator("[data-tour='tab-strip']");
  await strip.getByRole("button", { name: label, exact: false }).first().click();
  await settle(page);
  await dismissTour(page);
}

/** Select a loan in the Manager tab application queue by borrower name. */
async function selectLoan(page: Page, borrowerFragment: string) {
  const row = page.locator("button", { hasText: borrowerFragment }).first();
  await row.click();
  await settle(page);
}

/** Switch the per-loan workbench sub-tab (Overview / CAP / PCAF / ...). */
async function openSubtab(page: Page, label: string) {
  const strip = page.locator("[data-tour='workbench-subtabs']");
  await strip.getByText(label, { exact: false }).first().click();
  await settle(page);
}

/** Dismiss the tour overlay if one is running. Safe to call repeatedly. */
async function dismissTour(page: Page) {
  for (const pattern of [/end tour/i, /stop tour/i, /^stop$/i]) {
    const btn = page.getByRole("button", { name: pattern });
    if (await btn.count()) {
      await btn.first().click();
      await settle(page, 400);
      break;
    }
  }
  // Belt and braces: Escape closes the overlay in most states.
  await page.keyboard.press("Escape").catch(() => {});
  await settle(page, 200);
}

// ---------------------------------------------------------------------------
// The eight core screens
// ---------------------------------------------------------------------------

const SHOTS: Shot[] = [
  {
    file: "01-my-work.png",
    caption:
      "My Work. The officer's personal queue, split into assigned loans and " +
      "an available-to-claim pool, with follow-up items surfaced above.",
    url: "/",
    prepare: async (page) => {
      await dismissTour(page);
      await openTab(page, "My Work");
    },
  },
  {
    file: "02-manager-queue.png",
    caption:
      "Manager tab. Every commercial loan under review on one row, with the " +
      "escalation banner and the portfolio-wide overdue corrective actions " +
      "banner surfacing themselves above the queue.",
    url: "/",
    prepare: async (page) => {
      await dismissTour(page);
      await openTab(page, "Manager");
    },
  },
  {
    file: "03-workbench.png",
    caption:
      "Per-loan workbench. The compliance stripe reads the loan in three " +
      "seconds; the sub-tabs below hold every obligation attached to it.",
    url: "/",
    prepare: async (page) => {
      await dismissTour(page);
      await openTab(page, "Manager");
      await selectLoan(page, "Hongshi");
    },
  },
  {
    file: "04-esdd-wizard.png",
    caption:
      "ESDD wizard. NRB Annex 5 transcribed word for word, with the four NRB " +
      "answer options, guidance notes, remarks, and evidence attachment on " +
      "every question.",
    url: `/esdd/${CEMENT_LOAN}?tourStep=1`,
    selector: "[data-tour='esdd-wizard']",
    prepare: dismissTour,
  },
  {
    file: "05-taxonomy-wizard.png",
    caption:
      "Green Finance Taxonomy wizard. Activity selection from the NRB 2024 " +
      "catalogue, with suggestions driven by the borrower's sector.",
    url: `/taxonomy/${CEMENT_LOAN}?tourStep=1`,
    selector: "[data-tour='taxonomy-wizard']",
    prepare: dismissTour,
  },
  {
    file: "06-cap-panel.png",
    caption:
      "Corrective actions, covenants, and monitoring. Time-bound items under " +
      "the 2022 Guideline section 7.3.5, with periodic monitoring under 7.3.7.",
    url: `/cap/${CEMENT_LOAN}`,
    // Scope to the wizard shell rather than the inner panel. CapPanel
    // returns null when the loan has no saved ESRM screening or is rated
    // Low (cap-panel.tsx, the `!data.applicable` guard), so targeting the
    // panel makes the capture fail silently on a data problem instead of
    // showing it. The shell always renders.
    selector: "[data-tour='cap-wizard']",
    maxAspect: 1.5,
    prepare: async (page) => {
      await dismissTour(page);
      // Give the CAP bundle fetch time to resolve before we judge the frame.
      await page.waitForTimeout(1500);
      const panel = page.locator("[data-tour='cap-panel']");
      if ((await panel.count()) === 0) {
        console.warn(
          "        note: CAP panel did not render. The loan likely has no " +
            "saved ESRM screening, or is rated Low. Check /cap/" +
            CEMENT_LOAN +
            " in a browser."
        );
      }
    },
  },
  {
    file: "07-pcaf-availability.png",
    caption:
      "PCAF data availability. Four flag rows on the PCAF option ladder, " +
      "auto-suggested from the borrower record and confirmed by the officer " +
      "with evidence.",
    url: `/pcaf/${CEMENT_LOAN}`,
    selector: "[data-tour='pcaf-availability-panel']",
    prepare: dismissTour,
  },
  {
    file: "08-nfrs-disclosure.png",
    caption:
      "NFRS disclosure surface. Headline financed emissions, the NRBSIS " +
      "Annex 4b return generated in one click, and the PCAF data quality " +
      "distribution that defends the number.",
    url: "/",
    prepare: async (page) => {
      await dismissTour(page);
      await openTab(page, "NFRS");
    },
  },
];

/** Extras. Not in the eight, but cheap to capture and useful to have. */
const EXTRAS: Shot[] = [
  {
    file: "09-pf-screening.png",
    caption:
      "Annex 5b project finance screening. Applies to project-finance loans " +
      "only; items are mapped to the eight IFC Performance Standards.",
    url: `/pf-screening/${HYDRO_LOAN}?tourStep=0`,
    selector: "[data-tour='pf-screening-wizard']",
    // All 148 items render at once; without a cap this is ~18,000px tall.
    maxAspect: 1.3,
    prepare: dismissTour,
  },
  {
    file: "10-nrbsis-filing.png",
    caption:
      "The NRBSIS Green Finance Statement panel. One click produces the " +
      "Annex 4b return as bank-branded Excel, PDF, or JSON.",
    url: "/",
    selector: "[data-tour='nrbsis-green-statement']",
    prepare: async (page) => {
      await dismissTour(page);
      await openTab(page, "NFRS");
    },
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function capture(browser: Browser, shot: Shot): Promise<boolean> {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: "dark",
  });

  // Pre-set the tenant and officer cookies so the app skips the access-code
  // screen and the officer picker, and renders in Laxmi Sunrise branding.
  const { hostname } = new URL(BASE);
  await ctx.addCookies([
    { name: "jana_demo_tenant", value: TENANT, domain: hostname, path: "/" },
    { name: "jana_demo_officer", value: OFFICER_ID, domain: hostname, path: "/" },
  ]);

  const page = await ctx.newPage();
  try {
    await page.goto(BASE + shot.url, { waitUntil: "networkidle", timeout: 60_000 });
    await settle(page, 1400);
    if (shot.prepare) await shot.prepare(page);
    await settle(page, 700);

    const dest = path.join(OUT_DIR, shot.file);
    if (shot.selector) {
      const el = page.locator(shot.selector).first();
      await el.waitFor({ state: "visible", timeout: 15_000 });
      let box = await el.boundingBox();
      // A 148-item wizard is ~18,000px tall. Placed in a PDF that is an
      // unreadable strip, so clip tall elements to a sane aspect ratio and
      // keep the top of the element, which is the informative part.
      // locator.screenshot() has no clip option, so fall back to a
      // page-level clipped capture after scrolling the element into view.
      if (box && shot.maxAspect && box.height / box.width > shot.maxAspect) {
        await el.scrollIntoViewIfNeeded();
        await settle(page, 400);
        box = await el.boundingBox();
        if (box) {
          await page.screenshot({
            path: dest,
            clip: {
              x: Math.max(0, box.x),
              y: Math.max(0, box.y),
              width: Math.min(box.width, VIEWPORT.width - Math.max(0, box.x)),
              height: Math.min(
                box.width * shot.maxAspect,
                VIEWPORT.height - Math.max(0, box.y)
              ),
            },
          });
        } else {
          await page.screenshot({ path: dest });
        }
      } else {
        await el.screenshot({ path: dest });
      }
    } else {
      await page.screenshot({ path: dest });
    }
    const kb = Math.round(fs.statSync(dest).size / 1024);
    console.log(`  ok    ${shot.file}  (${kb} KB)`);
    return true;
  } catch (err) {
    console.warn(`  FAIL  ${shot.file}  ${(err as Error).message.split("\n")[0]}`);
    return false;
  } finally {
    await ctx.close();
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`base   : ${BASE}`);
  console.log(`tenant : ${TENANT}  (officer ${OFFICER_ID})`);
  console.log(`out    : ${OUT_DIR}`);
  console.log(`canvas : ${VIEWPORT.width}x${VIEWPORT.height} @${SCALE}x\n`);

  // Fail early with a useful message rather than ten confusing timeouts.
  try {
    const probe = await fetch(BASE + "/api/dashboard-data");
    if (!probe.ok) throw new Error(`probe returned ${probe.status}`);
  } catch (err) {
    console.error(
      `Cannot reach ${BASE}. Is the stack up and seeded?\n` +
        `  ${(err as Error).message}`
    );
    process.exit(1);
  }

  const browser = await chromium.launch();
  const all = [...SHOTS, ...EXTRAS];
  let ok = 0;
  for (const shot of all) {
    if (await capture(browser, shot)) ok++;
  }
  await browser.close();

  // Manifest, ready to paste into Appendix A.
  const manifest = [
    "# Appendix A: Platform Screenshots",
    "",
    `_Captured from the ${TENANT} tenant at ${VIEWPORT.width}x${VIEWPORT.height}, ${SCALE}x scale._`,
    "",
    ...all.map(
      (s, i) => `**Figure ${i + 1}.** ${s.caption}\n\n![${s.caption}](${s.file})\n`
    ),
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "manifest.md"), manifest);

  console.log(`\n${ok}/${all.length} captured`);
  console.log(`manifest: ${path.join(OUT_DIR, "manifest.md")}`);
  if (ok < all.length) {
    console.log(
      "\nFailures are usually a selector drift or an unseeded database.\n" +
        "Re-run the three seed endpoints, then try again."
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
