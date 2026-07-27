# NRB compliance verbatim session — handoff document

**Audience:** Jana methodology analyst (technical) + bank ESRM / compliance
lead (regulatory)

**Purpose:** provide the exact list of regulatory content that needs
verbatim review against the NRB source documents, the workflow to do it,
and a sign-off template. All the demo-quality content is in place and
reviewed for structure; what remains is confirming each question's
wording, threshold, and citation against the source PDFs.

**Estimated time:** 30-45 minutes per taxonomy activity (10 activities)
plus 20-30 minutes per sector supplement (7 supplements) plus 45-60
minutes reviewing the DNSH library. Full pass roughly 12-14 hours of
paired review time, splittable across sessions.

---

## 1. Source documents

Both documents live outside this repo — the bank's compliance office
should already have them; a working PDF of each should be in the shared
drive for reference during the session.

| Document | Version | Coverage |
|---|---|---|
| NRB Environmental & Social Risk Management Guidelines | 2018 (Circular 22, FY 2074/75) | ESDD Annex 5 checklist, sector supplements (Annex 2 hydropower, Annex 3 industrial) |
| NRB Green Finance Taxonomy | October 2024 | Activity catalog, DNSH checks, colour classification thresholds |

Where the demo content says "first-pass content, verbatim upgrade
pending", the reviewer should compare against these documents.

---

## 2. What has been reviewed for STRUCTURE

The demo team has verified the structural correctness of the following:

- **NRB ESRM 2018 Annex 5** — Sections 1, 2, and 3 (11 core questions).
  Wording is transcribed close to verbatim from the source; the a/b/c/d
  option structure is verbatim. **This is the highest-confidence
  content in the codebase.** Reviewer confirms wording; no restructure
  expected.
- **Escalation logic** — any 'c' answer triggers credit-committee
  escalation per NRB ESRM guidance. Scoring engine implemented and
  tested. Reviewer confirms rules.
- **Taxonomy structure** — Green / Amber / Red / Unclassified colours
  plus DNSH concept. Structure verified against the October 2024 source.
- **DNSH library structure** — extracted into a single central library
  so a check like "environmental_flow" is defined once and referenced by
  every activity that requires it. Verified for internal consistency.

## 3. What NEEDS verbatim review

### 3.1 Taxonomy activity catalog

File: `lib/regulatory/taxonomy/activities.ts`

10 activities are encoded. Each has: name, sector label, NRB citation,
activity-specific criteria, DNSH check ids, classifier logic.

For each activity, verify against NRB GFT October 2024:

| Field | Verify |
|---|---|
| `name` | Matches the activity name in the source doc |
| `nrbCitation` | Chapter / section / annex reference is correct |
| `sectorLabel` | Matches NRB's economic sector heading |
| `applicableTo` | Substrings match the sector labels the bank uses on its loan book |
| `activityCriteria[].prompt` | Question wording matches the source |
| `activityCriteria[].helpText` | Supplementary guidance is accurate |
| Numeric thresholds (e.g. cement 15% alternative fuel, buildings 20% energy savings) | Confirm the exact threshold value NRB specifies |
| `dnshCheckIds` | The right DNSH checks are listed (see §3.3) |
| `classify()` decision tree | Colour returned matches NRB's classification logic |

Activities to review:

| id | Sector | NRB citation to verify against |
|---|---|---|
| hydro-small | Renewable Energy | Ch. 2 / Annex 1 Renewable Energy |
| hydro-medium | Renewable Energy | Ch. 2 / Annex 1 Renewable Energy |
| hydro-large | Renewable Energy | Ch. 2 / Annex 1 Renewable Energy |
| solar-utility | Renewable Energy | Ch. 2 Renewable Energy |
| cement-whr | Industry | Ch. 2 Industry — Cement |
| green-buildings | Buildings | Ch. 2 Buildings |
| organic-agri | Agriculture and Food Security | Ch. 2 Annex 1 §1 Agriculture |
| ev-transport | Transport | Ch. 2 Transport |
| fossil-generation | Energy — exclusions | Ch. 2 Exclusions |
| irrigation-efficiency | Water and Wastewater | Ch. 2 §1.15 Irrigation |

**Recommended session cadence:** batch the three hydro activities in
one session (shared DNSH checks so the discussion overlaps), cement +
buildings + irrigation in another (all have numeric-threshold criteria
to verify), and the rest in a third.

### 3.2 Sector supplements to Annex 5

File: `lib/regulatory/esdd/annex5-questions.ts` — `ANNEX5_SECTOR_SUPPLEMENTS`

7 sector supplements are encoded. Each adds 3-4 sector-specific
questions on top of the 11 core Annex 5 items.

For each supplement, verify against NRB ESRM 2018 Annex 2 (hydropower)
or Annex 3 (industrial), following the same field checklist as §3.1:
question wording, option a/b/c/d wording, guidance notes, and citation.

| Slug | Source annex |
|---|---|
| hydropower | Annex 2 |
| cement | Annex 3 — Cement industry |
| textiles | Annex 3 — Textile industry |
| steel | Annex 3 — Steel / metals industry |
| chemicals | Annex 3 — Chemicals industry |
| brick | Annex 3 — Brick kilns (Nepal-specific supplementary directive) |
| agriculture | Annex 3 — Agriculture / agribusiness |

**Non-negotiable check:** the brick supplement's question B.3 flags
child / bonded labour as automatic escalation. Nepal brick kilns are a
known high-risk sector globally; the wording here must match the source
directive exactly. Do not soften.

### 3.3 DNSH check library

File: `lib/regulatory/taxonomy/dnsh.ts` — `DNSH_CHECKS`

7 shared DNSH checks defined. For each check, verify against NRB GFT
October 2024 DNSH annex:

| Check id | Category | NRB source section |
|---|---|---|
| environmental_flow | water | DNSH · Water |
| resettlement_discharged | community | DNSH · Social |
| biodiversity_offset | biodiversity | DNSH · Biodiversity |
| cumulative_basin_impact | biodiversity | DNSH · Biodiversity |
| quarry_rehabilitation | biodiversity | DNSH · Biodiversity |
| land_use_conflict | biodiversity | DNSH · Biodiversity |
| seismic_assessment | climate_adaptation | DNSH · Climate adaptation |

For each check, review:
- `label` — short human name
- `criterion.prompt` — the question the officer answers
- `criterion.helpText` — guidance about what "yes" and "no" mean
- `failureReason` — text shown when the check fails; goes into the
  classification rationale
- `citation` — the NRB section reference

**Editing a DNSH check propagates to every activity that uses it.**
This is deliberate. Confirm the wording is universally applicable
across all consuming activities before publishing.

### 3.4 Activities and sectors NOT yet in the catalog

The demo covers the 10 most common Nepal cases. The full NRB taxonomy
lists more. The bank should decide which additional activities matter
for their portfolio and add them via `defineActivity()` calls in
`activities.ts` — same pattern as the existing 10.

Common additions to consider:

- Wind generation (Renewable Energy)
- Bagasse cogeneration (Industry / Renewable Energy)
- Waste-to-energy (Circular Economy)
- Textile mills with ETP (Industry — currently only sector-supplement content, no taxonomy activity)
- Green hydrogen (Energy)
- Public transport electrification (Transport)
- Wastewater treatment plants (Water)
- Solid waste management (Circular Economy)
- Sustainable forestry (Land use)

For each new activity, the bank + analyst should agree:
- Name + sector + NRB citation
- Activity-specific criteria (permits, capacity, efficiency thresholds)
- DNSH check ids (pick from the library or propose new ones)
- Classification decision tree (Green / Amber / Red logic)

---

## 4. Review workflow

### 4.1 Per-item workflow

For each activity, sector supplement, or DNSH check:

1. Open the source PDF to the relevant section.
2. Open the corresponding code file at the relevant const / function.
3. Read both side-by-side. For each field in the review checklist
   (§3.1 / §3.2 / §3.3), record one of:
   - **Verbatim OK** — code matches source, no change needed.
   - **Update wording** — code is close but wording should change.
     Note the exact source language to use.
   - **Update threshold / citation** — a numeric threshold or reference
     needs correction. Note the correct value.
   - **Structural change** — the option / criterion / decision tree
     needs to be restructured. Escalate to a design pairing session
     with the Jana methodology analyst before making code changes.
4. Log each decision in the sign-off template (§5).

### 4.2 Code change workflow

Once the reviewer has flagged the changes:

1. Jana methodology analyst applies the changes in a feature branch
   named `compliance/verbatim-<yyyymmdd>`.
2. Wording updates: edit the const in place, keep the criterion `id`
   stable (do not rename — saved rows reference these strings).
3. Threshold updates: edit the const AND the classifier function that
   uses it. Add a code comment referencing the source page number.
4. Structural changes: pair with a Jana engineer for review before
   merging.
5. Run `npx tsc --noEmit` to confirm no type errors.
6. Open a PR to the `main` branch tagged `regulatory-review`. Request
   review from both the reviewer who signed off and one Jana engineer.

### 4.3 Data migration

For any change that renames a criterion `id` or removes a criterion:

1. Query how many rows use the old id:
   ```sql
   SELECT count(*) FROM bfi_taxonomy_assessments
   WHERE criterion_answers ? '<old_id>';
   SELECT count(*) FROM bfi_esdd_responses
   WHERE question_id = '<old_id>';
   ```
2. If zero, safe to change.
3. If non-zero, either:
   - Data-migrate first: `UPDATE ... SET criterion_answers =
     jsonb_set(criterion_answers - '<old_id>', '{<new_id>}',
     criterion_answers -> '<old_id>')` and similar for ESDD.
   - Or preserve backward compatibility: keep the old id as an alias
     in the criterion definition.

The Phase 6a DNSH refactor (see git log) is an example where the
default was "accept the break" because we're in demo state. Production
changes should not follow that precedent.

---

## 5. Sign-off template

Copy this template into a shared doc for each review session. Fill in
as the review proceeds. At session end, both parties initial the
"Reviewed by" and "Verified by" cells for every item.

```
Session date: YYYY-MM-DD
Reviewer (bank compliance): _____________
Reviewer (Jana methodology): _____________
Duration: __h __m
Source doc(s) reviewed: _____________

Items reviewed:

| Type    | ID / Slug          | Field         | Decision       | Notes                     | Reviewed by | Verified by |
|---------|--------------------|---------------|----------------|---------------------------|-------------|-------------|
| DNSH    | environmental_flow | prompt        | Verbatim OK    |                           | AB          | CD          |
| DNSH    | environmental_flow | failureReason | Update wording | Use "downstream release"  | AB          | CD          |
| Activity| hydro-small        | classify tree | Update logic   | 25 MW threshold is < 25   | AB          | CD          |
| ...     | ...                | ...           | ...            | ...                       |             |             |

Blockers / questions to escalate:
- ...

Next session focus:
- ...
```

---

## 6. Deliverables at end of session series

When the full pass is complete, expect:

1. A PR titled "Verbatim compliance pass — YYYY-MM" merged to `main`,
   with commits scoped per reviewed batch.
2. An updated citation footer in each activity referencing the
   verbatim-source page numbers, so future audits can trace back.
3. A tagged release `v1.0-compliance-verbatim` marking the point at
   which the taxonomy content is verbatim-certified.
4. This handoff document updated to note the sign-off date and the
   sign-off signatories.
5. Optionally: an "excluded" section in this doc listing activities /
   supplements the bank considered but decided not to encode
   (out-of-scope for their portfolio), with the rationale.

---

## 6.1 NRBSIS Green Finance Statement — filing-format export

The current `/api/reports/nrb-taxonomy` export produces a bank-branded
PDF and xlsx that show every classified loan with rationale, citation,
and DNSH detail, plus a portfolio-scope summary. That is genuinely
useful for the bank's internal file and for auditor review.

It is NOT the exact format that NRB accepts in its Supervisory
Information System (NRBSIS). NRBSIS uses XBRL electronic filing —
schema files with named elements, not a free-form PDF — and NRB issued
circulars to Class A / B / C / IDB banks starting mid-July 2023
requiring compliance data through that portal.

To make our export "filing-ready" we need the exact NRBSIS Green
Finance Statement schema. It is not on the open web (bank-facing
regulatory instrument), but the bank's compliance office has access to
it via their supervisory portal login. Ask the compliance lead:

- The NRBSIS Green Finance Statement submission template
  (Excel or XBRL taxonomy files)
- The circular that specifies cadence, deadlines, and any lookup
  code lists

Once we have those, building a matching exporter is roughly a half day.
The current classification report already carries the underlying data;
we just need to shape it to the target schema.

Alternatives if the compliance office is slow:

- The NRB Green Finance Taxonomy 2024 PDF (Oct 2024) contains
  reporting annexes inline. Someone on the Jana side should read the
  annex section end-to-end and note whether the sector-wise
  loans-and-advances table structure can be assembled from the public
  document alone.
- IRIS RegTech Solutions (Nepal) sells an NRB-SIS XBRL reporting
  product; they know the schema and could confirm whether it can be
  licensed for our use or replicated.

## 7. Contact points

- Jana engineering (for code / migration questions): via the shared
  Jana Slack.
- NRB compliance interpretation (for genuine regulatory ambiguity):
  the bank's ESRM lead escalates to NRB directly. Do not have the demo
  team interpret NRB rules unilaterally.
- Timeline pressure: prioritise the taxonomy activities most common in
  the bank's portfolio first. The full 10-activity + 7-supplement pass
  can be spread across the compliance team's normal workload over 2-3
  months.
