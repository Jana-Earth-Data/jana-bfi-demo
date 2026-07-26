# Laxmi Sunrise demo kit — screencast script + pre-demo checklist

This doc has two halves:
1. **Pre-demo checklist** — what to run before every rehearsal or live meeting.
2. **Screencast script** — narrated walkthrough that aligns with the audio tour, for cases where you want a click-along instead of the auto-pilot.

Keep this doc open in a second tab during the meeting.

---

## Part 1 — Pre-demo checklist

Complete these steps in order. Timing: about 10 minutes for a fresh
rehearsal, 3 minutes if you're prepping between back-to-back demos.

### Step 0 — Environment sanity
- [ ] Local dev is running: `npm run dev` in the repo root, dashboard at http://localhost:3001
- [ ] Supabase project is reachable — one quick browser refresh at http://localhost:3001 confirms the officer picker roster loads.
- [ ] Tenant registry has the target bank's config in `lib/tenants/registry.ts`. For Laxmi that's `laxmi_sunrise` with access code `LX-K7QN2P`.
- [ ] If you're demoing production: pull the latest branch, verify build (`npm run build`) succeeds.

### Step 1 — Wipe captured data for the target tenant
Rehearsals accumulate state that skews the story ("2 loans already
have amber taxonomy, why?"). Wipe before every demo.

- Navigate to http://localhost:3001/admin/reset
- Pick the tenant → type the display name exactly → paste the admin
  bearer token (env `SEED_ADMIN_TOKEN` on the dev server; ask ops for
  the value if you don't have it) → click **Discard and exit**
- Confirm the response shows non-zero counts across the five capture
  tables — that's evidence the reset ran

Alternative: hit the API directly:
```
curl -X POST http://localhost:3001/api/admin/reset \
  -H "Authorization: Bearer $SEED_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"laxmi_sunrise","confirmName":"Laxmi Sunrise Bank"}'
```

### Step 2 — Seed officer roster (only if never done)
- The bfi_officers table needs the roster for the picker to populate.
- If empty for the tenant: POST /api/admin/seed-officers with the same
  admin token. See the endpoint's source for the exact request shape.

### Step 3 — Regenerate audio tour if the script changed
The tour audio files under `public/audio/tour-*.mp3` are pre-generated
from `data/tour-script.json`. If you changed the script:

```
python3 scripts/generate-tour-audio.py --force
```

Requires `tts.key` (OpenAI API key) at the repo root — gitignored.
Individual step regeneration: `python3 scripts/generate-tour-audio.py
--step <id>` where `<id>` is one of `intro`, `loan-card`, `esdd-wizard`,
`escalation`, `manager-view`, `taxonomy`, `compliance-drawer`,
`nsrs-taxonomy`, `export`, `closing`.

### Step 4 — Browser prep (2 minutes)
- Open Chrome in an incognito window (no extensions, no cached auth)
- Set the window to 1440x900 or 1600x1000 — the layout is tuned for
  those widths; smaller and the manager view queue gets crowded, wider
  and the workbench gets over-stretched
- Navigate to http://localhost:3001/?bank=LX-K7QN2P — this sets the
  tenant cookie and redirects home
- Open the officer picker and sign in as **Sujata Adhikari** (loan
  officer)
- Have http://localhost:3001/#mywork already loaded so the first
  screen is the officer's queue
- Kill any browser popups (permissions, translation prompts, "leave
  site?" dialogs)

### Step 5 — Prime the demo data
For the demo to tell a full story you need at least one loan with a
completed ESDD screening, one loan with an escalation, and one loan
with a taxonomy classification. Cheapest path:

- Open a cement borrower (Hongshi-Shivam is the canonical one)
- Complete the ESDD checklist and save the screening — set at least
  one Section 3 answer to 'c' so the escalation demo works
- Complete the Taxonomy classification against "Cement plant — with
  Waste Heat Recovery" — set alternative fuel share to 20% for an
  Amber outcome (Green requires ≥50% which we don't want during a
  quick demo)

Repeat for a hydro borrower (Himal Power Limited is the canonical
one) — pick the small hydro activity, answer the DNSH questions
positively for a Green outcome.

Once done, the manager view will show the escalation banner, the
compliance stripe will render with real state, and the NSRS taxonomy
breakdown will populate with two loans in the color buckets.

### Step 6 — Verify the demo checklist
Quick tour through the pieces you'll show:

- [ ] My Work tab: Sujata's queue shows loans with ESDD + Taxonomy
  chips visible; the escalation card is at the top
- [ ] Click a loan → ESDD wizard resumes to the saved state
- [ ] ESRM tab: escalation banner at the top with the driving question
  numbers; owner assignments visible; compliance stripe renders inline
- [ ] Loan Book: pick any loan → drawer shows the two-CTA stripe
  (ESDD + Taxonomy)
- [ ] NSRS tab: taxonomy breakdown shows the color buckets with the
  correct counts; regulatory export button works
- [ ] Click "Excel" in the regulatory exports — file downloads,
  opens, shows bank branding (Laxmi Sunrise logo + orange primary)
- [ ] Play the guided tour — audio plays and spotlights land on the
  correct surfaces

Anything red → do NOT do the meeting. Fix first.

---

## Part 2 — Screencast script

For a manual click-along (no auto-pilot). Roughly 8-10 minutes
depending on pace. Section headings are the beats; italic is speaker
prompt; **bold** is what to click or where to look.

### 1. The problem (30 seconds)
> *"Nepal Rastra Bank has three environmental regulations. ESRM screening from 2018 requires every commercial loan to be assessed for environmental risk before approval. The Green Finance Taxonomy from October 2024 requires banks to classify their book as green, amber, or red. And starting 2026-27, NSRS requires annual financed-emissions disclosures. Most Nepali banks are stuck on all three — not because they don't want to comply, but because the data infrastructure doesn't exist yet."*

### 2. The officer view (1 minute)
**Click My Work tab.**
> *"This is Sujata Adhikari's screen. Sujata is a loan officer at Laxmi Sunrise. Her queue shows every loan Laxmi has assigned to her. Each card carries both regulatory obligations — the ESDD checklist status on the left chip, the Green Finance Taxonomy classification on the right chip if the sector is eligible. She sees at a glance what needs her attention today."*

**Point at a loan card.**
> *"Two buttons per card. Start ESDD, or Classify taxonomy. She picks whichever flow is more useful right now — the platform doesn't dictate the order. The recommended action is styled solid; the other is outlined."*

### 3. ESDD wizard (1.5 minutes)
**Click Start ESDD on a cement borrower.**
> *"This is the NRB ESRM Annex 5 checklist — transcribed verbatim from the 2018 directive. Eleven core questions across general risk, environmental health and safety, and social risks."*

**Scroll to Section 4.**
> *"For sectors NRB names specifically, we add a sector supplement. This is a cement borrower so the wizard adds three cement-specific questions on kiln stack emissions, quarry rehabilitation, fugitive dust. Same for hydropower, brick, textiles, steel, chemicals, agriculture."*

**Answer questions, deliberately pick a 'c' answer on Section 3.**
> *"Every answer auto-saves as I record it. Every save is attributed to Sujata's officer identity and timestamped for the audit trail. There is no submit button — she can walk away and come back."*

**Navigate to Review step, click Compute risk and save screening.**
> *"When she's ready, the scoring engine runs the NRB rules over her answers and produces a risk class and recommendation. In this case we hit a 'c' answer in Section 3, so the loan is auto-escalated to the credit committee. No manual triage, no lost escalations."*

### 4. Manager view (1.5 minutes)
**Click ESRM tab.**
> *"Now switch hats — this is the compliance manager's view. Every loan under review is here, with the assigned officer, the ESDD checklist progress, and the risk classification. At the top: the escalation banner listing every 'c'-flagged loan across the whole book. Click any pill to jump into that loan's screening."*

**Click the escalated loan.**
> *"The workbench shows the compliance state front and centre — ESDD chip on the left, taxonomy chip on the right, escalation banner listing the specific driving questions inline. The manager doesn't have to hunt through a per-question drawer to see what's wrong. It's here."*

**Show the owner dropdown at the top of the workbench.**
> *"Assignment control right at the top. Reassign the loan to a different officer with one click. All persists to Supabase, all reflected in the officer's queue on the next refresh."*

### 5. Taxonomy classification (1.5 minutes)
**Back to My Work, click Classify taxonomy on the same cement loan.**
> *"Now the second regulatory flow — Green Finance Taxonomy classification from October 2024. The wizard suggests activities based on the borrower's sector. Cement plant with waste-heat recovery — that's this one."*

**Answer the criteria — alternative fuel 20%.**
> *"The criteria split into activity-specific questions and DNSH questions. DNSH is 'do no significant harm' — the taxonomy principle that says an activity can't count as green if it materially harms another environmental objective. We keep the DNSH checks in a central library so the same check — environmental flow, resettlement, seismic assessment — is defined once and referenced by every activity that uses it. No drift, no re-encoding."*

**Continue to Review.**
> *"Preview shows the derivation live from her answers. Amber — transitional — because cement remains a hard-to-abate sector under NRB's own methodology. Save the classification and it's in the audit trail."*

### 6. NSRS disclosure roll-up (1 minute)
**Click NSRS tab, scroll to Taxonomy portfolio breakdown.**
> *"Every classification the officers save rolls up into the annual disclosure automatically. Four buckets — Green, Amber, Red, Unclassified — with the outstanding NPR totals. The Amber transitional bucket is broken out on its own terms because NRB's October 2024 rules require it to be reported separately from fully-aligned Green."*

**Point at the "N loans not yet classified" callout.**
> *"And loans in taxonomy-eligible sectors that haven't been classified yet are flagged so nothing slips through the annual filing."*

### 7. Regulatory export (30 seconds)
**Scroll up to Regulatory exports panel. Click PDF.**
> *"One click to export the full classification report as a PDF in NRB submission format. Or Excel for the bank's compliance office. Or JSON if the bank wants to pipe it into their own downstream systems. Every file carries Laxmi Sunrise's branding — logo, primary color, display name — because the document is being filed by Laxmi, not by Jana."*

**Open the downloaded PDF, point at the cover.**
> *"Ready to attach to the NRB submission."*

### 8. Close (30 seconds)
> *"So what you've just seen is one platform that handles all three of Nepal Rastra Bank's environmental regulations. Verbatim ESRM Annex 5 capture from the 2018 directive. Green Finance Taxonomy classification from October 2024 with the central DNSH library. And NSRS-ready portfolio disclosures for 2026 and 2027, exported bank-branded and ready to file. Every capture is officer-attributed and timestamped. Every taxonomy assessment carries its NRB citation. And underneath the workflow, the emissions numbers come from Climate TRACE and EDGAR — independently verifiable data sources the regulator will accept."*

**Pause. Look at the questioner.**
> *"Happy to walk through any of it in more depth."*

---

## Common gotchas

- **Blank My Work queue**: Sujata isn't signed in. Officer picker in the header → pick her.
- **Missing officer roster**: bfi_officers isn't seeded. See Step 2 above.
- **Escalation banner missing**: no loan has an actual 'c' answer saved yet. Follow Step 5.
- **Taxonomy breakdown all zeros**: no taxonomy classification saved yet. Follow Step 5.
- **Audio tour silent**: MP3 files missing or not regenerated. See Step 3.
- **Reports button 500s**: xlsx or pdfkit dependency wasn't installed. `npm install exceljs pdfkit`.
- **Reset button 500s**: SEED_ADMIN_TOKEN not set in the dev server's env. Set it and restart `npm run dev`.
- **Tour tab-switching feels sluggish**: browser is caching. Hard-refresh once (Cmd-Shift-R), then restart the tour.

---

## Followups tracked for after the meeting

Playwright smoke tests for the four wizard flows aren't in the repo
yet — deploying that infra is its own session. Track as a follow-up
sprint before we scale to more prospects.

Verbatim compliance pass on the taxonomy activities + sector
supplements — see `design_docs/COMPLIANCE_SESSION_HANDOFF.md`.

"Recently closed" section on My Work is stubbed — needs a loan-status
change model (loan approved / declined / withdrawn events) to
populate for real. Currently hidden when empty.
