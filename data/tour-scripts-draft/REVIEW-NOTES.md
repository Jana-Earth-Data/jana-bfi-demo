# Tour narration draft — review notes (P32)

Drafts live at `data/tour-scripts-draft/default/`. Current scripts at `data/tour-scripts/default/` are untouched. Diff with:

```
diff -u data/tour-scripts/default/dashboard.json data/tour-scripts-draft/default/dashboard.json
diff -u data/tour-scripts/default/loan-officer.json data/tour-scripts-draft/default/loan-officer.json
diff -u data/tour-scripts/default/manager.json data/tour-scripts-draft/default/manager.json
diff -u data/tour-scripts/default/pcaf.json data/tour-scripts-draft/default/pcaf.json
diff -u data/tour-scripts/default/pf-screening.json data/tour-scripts-draft/default/pf-screening.json
```

Once approved, mirror to `data/tour-scripts/laxmi_sunrise/` with Riya → Sujata (already the laxmi convention), `First Bank of Nepal` → `Laxmi Sunrise Bank Ltd.`, then regenerate audio with `scripts/generate-tour-audio.py`.

---

## 1. What changed in each tour

### `dashboard.json` — elevator pitch
- **Reframe angle:** From "banks lack facilities data → Jana provides it" to "NRB requires a full stack (Circular 22 + Green Taxonomy + Annex 5b + CAP/covenants/monitoring + PCAF/NFRS) → Jana is the workflow surface AND the data".
- **Old wedge** ("stuck on all three because they don't have facility-level emissions data") **removed** and replaced with "stuck because they lack workflow tools AND facility data".
- Every domain is touched once: taxonomy funnel, Manager tab, compliance stripe, sub-tabs, CAP panel, PF screening callout, overdue-CAP banner, NFRS headline, PCAF distribution.
- Facilities/Climate TRACE story is preserved but demoted from the headline — it lives in the PCAF data-quality step near the end.

### `loan-officer.json` — full lifecycle walkthrough
- **Reframe angle:** Same officer, same loan, but the walkthrough now runs end-to-end: My Work queue → follow-up reminders → loan card → ESDD wizard (with evidence upload called out) → risk review → **CAP + covenants + monitoring capture** (new step) → taxonomy activity + review → PCAF availability → back to queue.
- Two new steps inserted: **follow-ups panel** (step 2) and **CAP capture** (step 9). ESDD Section 2 narration now explicitly mentions evidence attachment (per P31).
- Old story that led with ESRM+Taxonomy as "the two flows" is broadened to "every NRB layer captured in the correct sequence".

### `manager.json` — the new Manager tab in depth
- **Reframe angle:** Explicit "we renamed ESRM → Manager because it does more than environmental risk now" opening. Structure moves through: intro → application queue → **collapsed-queue rail** (new, P33) → escalation banner → **portfolio-wide overdue-CAP banner** (new) → compliance stripe → **sub-tabs** (new) → **CAP + Covenants + Monitoring oversight** (new) → assignment → taxonomy roll-up → NRBSIS Annex 4b → exports → close.
- Old 7-step tour expanded to 13 steps to give room for the new surfaces without collapsing the NFRS export story.
- The collapsed-queue step reuses the existing `[data-tour='application-queue']` selector (the wrapper div wraps both expanded and collapsed states; see `esrm-tab.tsx:377`). No new `data-tour` attribute required.

### `pcaf.json` — one layer of a bigger disclosure
- **Reframe angle:** Opens with "PCAF is one piece of the NFRS filing, not the whole thing" and closes by pointing back to Green Taxonomy allocation, transition risk narrative, and governance disclosure — all reading from the same audit trail.
- Score 1-5 story and asset-class step preserved; airtime rebalanced away from "Score 3 is the moat" toward "here's where PCAF sits in the wider filing".
- 8 steps (unchanged count) with the Score 3 story tightened into one dedicated step rather than the recurring drumbeat of the current script.

### `pf-screening.json` — Annex 5b in context
- **Reframe angle:** Opener explicitly says "every commercial loan gets standard ESDD; PF loans get Annex 5b **on top**". Closer explicitly says "and from here the loan flows into the same lifecycle every other loan follows — CAP, covenants, monitoring, PCAF, taxonomy, NFRS".
- 148-item / 8-PS depth **preserved verbatim** — no PS deleted.
- Only the intro and closing changed materially; PS1-PS8 + Review narration retained with minor voice polish (removed lowercase-after-period artifacts from the current script).

---

## 2. Structural changes summary

| Tour | Current steps | Draft steps | Net change |
|------|---------------|-------------|------------|
| dashboard | 9 | 12 | +3 (manager queue, workbench sub-tabs, CAP panel, PF-screening callout, overdue-CAP banner — replaces "switch-to-esrm/borrower-detail/map-view" trio with a broader surface tour) |
| loan-officer | 13 | 14 | +1 (net: added follow-ups + CAP capture, dropped `taxonomy-basics` and `taxonomy-criteria` intermediate steps in favor of one taxonomy-picker + taxonomy-review pair — full activity list moved into the picker narration) |
| manager | 7 | 13 | +6 (overdue-CAPs banner, workbench sub-tabs, CAP oversight, NRBSIS Annex 4b split from exports, application-queue split from intro, collapsed-queue rail explainer) |
| pcaf | 8 | 8 | 0 (rebalanced narration; renamed steps: `drill-in` → `per-loan-panel`, `collection-*` → `availability-panel`/`evidence`) |
| pf-screening | 11 | 11 | 0 (framing change on intro + closing only) |

---

## 3. Data-tour selectors used in drafts — all already exist in code

Confirmed against the current `components/bfi/**` sources:

- `application-queue`, `assignment-control`, `cap-panel`, `climate-threshold-callout`, `compliance-stripe`, `data-quality`, `escalation-banner`, `esdd-pf-callout`, `esdd-wizard`, `facility-map`, `followups-panel`, `funnel`, `header`, `loan-card-primary`, `loan-table`, `my-work-queue`, `nfrs-headline`, `nrbsis-green-statement`, `overdue-caps-banner`, `pcaf-availability-panel`, `pcaf-panel`, `pf-screening-wizard`, `regulatory-exports`, `screening-workbench`, `tab-strip`, `taxonomy-breakdown`, `taxonomy-wizard`, `workbench-subtabs`.

**No new selectors are required.** All drafts spotlight elements that already exist in the UI.

### Potential (optional) additions Willard may want to add for future polish

None of these block the drafts from running — the tours degrade gracefully because the surrounding sub-tab / panel targets exist:

1. `[data-tour='settings-gear']` on `components/bfi/header.tsx:106` (the `/settings` link) — the P28 gear icon has no selector today. **Not referenced by any draft**, but worth adding if you want a future settings tour.
2. `[data-tour='evidence-attachments']` on `components/bfi/shared/evidence-attachments.tsx` — the P31 upload widget has no selector. Loan-officer step 6 narrates the evidence upload while spotlighting the whole ESDD wizard (`esdd-wizard`). Fine for now; add a selector if we want a tight callout later.
3. `[data-tour='pf-screening-callout']` alias — draft dashboard step 8 already uses `esdd-pf-callout`, which exists. No change needed.

---

## 4. Estimated new `totalDurationSecondsApprox`

I initially used the brief's 5.8 wds/sec multiplier, but the observed onyx cadence across the current five scripts sits at ~2.5 wds/sec (dashboard 4.1, loan-officer 2.5, manager 1.9, pcaf 1.6, pf-screening 2.1 — weighted mean ~2.5). Recalculated at 2.5 wds/sec:

| Tour | Current s | Draft words | Draft s (est.) |
|------|-----------|-------------|----------------|
| dashboard | 195 (9 steps, 801 w) | 1,223 | ~490 |
| loan-officer | 360 (13 steps, 904 w) | 1,046 | ~420 |
| manager | 220 (7 steps, 424 w) | 854 | ~345 |
| pcaf | 380 (8 steps, 619 w) | 720 | ~290 |
| pf-screening | 330 (11 steps, 707 w) | 814 | ~325 |
| **Total** | **1,485 s (~25 min)** | **4,657** | **~1,870 s (~31 min)** |

Runtime grows across the board because the reframed narration adds regulatory context (CAP capture, follow-ups, sub-tabs). Dashboard nearly doubles (195 → 490) because it now covers every domain instead of the ESRM→NFRS trio. PCAF *drops* from 380 → 290 because we tightened the Score-3 refrain into a single step. Numbers rounded generously; actual TTS runtime typically comes in ±10%.

---

## 5. Rejection triggers — what to flag if a rewrite is warranted

Watch specifically for:

- **Dashboard step 8 (`pf-screening-callout`)** navigates to a specific ESDD loan URL (`/esdd/L-0080028?tourStep=4`) mid-tour purely to spotlight the PF callout. If that jump feels jarring inside the elevator-pitch tour, cut this step and let the dedicated PF-screening tour carry the story.
- **Manager step 4 (`overdue-caps`)** and **step 7 (`cap-oversight`)** assume seeded overdue CAP items exist in the default tenant. If the demo data currently has zero overdue CAPs, the overdue banner will not render (it uses `targetOptional: true` so the tour skips gracefully, but the narration will feel disconnected). Consider seeding one overdue CAP before demo day.
- **PCAF step 8 (`closing`)** references "sustainability governance disclosure" as a future NFRS section. If we haven't built anything for that yet and don't want to promise it, tighten to just "taxonomy allocation and transition risk narrative".
- **Loan-officer step 2 (`followups`)** — verify `followups-panel` renders inside `my-work-queue` and not on a separate route. If it lives on a different page, add a `navigateTo`.
