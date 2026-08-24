#!/usr/bin/env python3
"""
Verify that the Supabase Cloud demo data matches the P46 regulatory rules.

Why this exists
---------------
`escalation_flag`, `computed_rationale` and `esdd_snapshot` are PERSISTED
columns, written once at save time by app/api/esrm/screenings/route.ts and
read straight back by the manager and officer queues. They are not
recomputed at render time.

That means deploying a corrected scoring engine does NOT retroactively fix
rows already in the database. After any change to the escalation rule or to
the Annex 5 question set, the demo data has to be re-seeded and then
verified -- which is what this script does.

What it checks
--------------
The table holds history: multiple screenings per loan, across multiple
tenants. The UI never shows all of them. app/api/manager/queue/route.ts
filters to one bank_id, orders by captured_at desc, and keeps the first row
per loan. This script reproduces that exactly, so it judges the same rows a
demo audience would actually see and ignores superseded history.

Against those live rows it asserts the two things P46 changed:

  1. NRB ESRM Guideline 2022 s7.3.6 -- any ESRR of MEDIUM or above carries
     escalation_flag, and LOW does not. This is asserted as a rule rather
     than as an expected count, because the correct count depends on how
     many loans are seeded and would go stale the moment that changes.

  2. Annex 5 has 13 questions including Q1.4 (land acquisition /
     resettlement). esdd_snapshot is a dict KEYED BY questionId, so the
     keys are the answered questions.

Usage
-----
    set -a; source .env.local; set +a
    python3 scripts/verify-seed.py

Exit codes: 0 = all checks passed, 1 = at least one check failed.
"""

import json
import os
import sys
import urllib.error
import urllib.request

EXPECTED_ANSWERS = 13
REQUIRED_QUESTION = "annex5.1.4"
# Anything at or above MEDIUM escalates one level; LOW does not.
ESCALATING = {"medium", "high", "extreme"}

TABLE = "bfi_esrm_screenings"
COLUMNS = "bank_id,loan_id,computed_risk_class,escalation_flag,captured_at,esdd_snapshot"

# Mirror of lib/regulatory/esdd/scoring.ts. Kept here so the script can say
# whether a STORED risk class is actually supported by the stored answers --
# the two can drift, and did: the cement screening shipped as "extreme" while
# its own answers (and its own rationale sentence) said HIGH.
ANSWER_WEIGHTS = {"a": 0, "b": 1, "c": 3, "d": None}
QUESTIONS_TS = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "lib", "regulatory", "esdd", "annex5-questions.ts",
)


def load_sections():
    """Parse questionId -> section out of the TypeScript question defs.

    Returns {} if the file cannot be read, in which case derivation checks
    are skipped rather than reported as failures.
    """
    try:
        with open(QUESTIONS_TS, encoding="utf-8") as fh:
            src = fh.read()
    except OSError:
        return {}
    import re
    return dict(
        re.findall(r'id:\s*"(annex5[^"]+)"[^}]*?section:\s*"(\w+)"', src, re.S)
    )


def derive_risk(snapshot, sections):
    """Recompute the risk class from the stored answers. None if unknowable."""
    if not sections or not isinstance(snapshot, dict) or not snapshot:
        return None
    buckets = {}
    for qid, entry in snapshot.items():
        sec = sections.get(qid)
        if not sec or not isinstance(entry, dict):
            continue
        weight = ANSWER_WEIGHTS.get(entry.get("answer"))
        if weight is None:
            continue
        b = buckets.setdefault(sec, {"n": 0, "w": 0, "c": 0})
        b["n"] += 1
        b["w"] += weight
        if entry.get("answer") == "c":
            b["c"] += 1
    if not buckets:
        return None
    means = [v["w"] / v["n"] for v in buckets.values() if v["n"]]
    total_c = sum(v["c"] for v in buckets.values())
    max_mean = max(means) if means else 0
    if total_c >= 3 or max_mean >= 2.5:
        return "extreme"
    if total_c >= 2 or max_mean >= 2.0:
        return "high"
    if total_c == 0 and all(m <= 0.5 for m in means):
        return "low"
    return "medium"


def fetch():
    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base or not key:
        sys.exit(
            "ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.\n"
            "Run:  set -a; source .env.local; set +a"
        )
    url = f"{base.rstrip('/')}/rest/v1/{TABLE}?select={COLUMNS}&order=captured_at.desc"
    req = urllib.request.Request(
        url, headers={"apikey": key, "Authorization": f"Bearer {key}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        sys.exit(f"ERROR: Supabase returned HTTP {exc.code}: {exc.read().decode()[:300]}")
    except urllib.error.URLError as exc:
        sys.exit(f"ERROR: could not reach Supabase: {exc.reason}")


def answered_questions(row):
    """esdd_snapshot is Record<questionId, {answer, remarks, ...}>.

    See app/api/esrm/screenings/route.ts -- the snapshot is built as a
    dictionary keyed by question id, so the keys ARE the answered questions.
    """
    snap = row.get("esdd_snapshot")
    if not isinstance(snap, dict):
        return set()
    return set(snap.keys())


def main():
    rows = fetch()
    sections = load_sections()
    if not sections:
        print("NOTE: could not read annex5-questions.ts -- "
              "skipping risk-class derivation checks.\n")

    # Reproduce the queue's dedupe: latest screening per (bank, loan).
    # Rows already arrive captured_at desc, so first seen wins.
    live = {}
    for row in rows:
        key = (row.get("bank_id"), row.get("loan_id"))
        if key not in live:
            live[key] = row

    superseded = len(rows) - len(live)
    print(f"{len(rows)} screening rows -> {len(live)} live "
          f"({superseded} superseded by a newer screening)")
    print()

    failures = []

    for bank in sorted({k[0] for k in live}, key=str):
        bank_rows = [v for k, v in live.items() if k[0] == bank]
        bank_rows.sort(key=lambda r: str(r.get("loan_id")))
        escalated = sum(1 for r in bank_rows if r.get("escalation_flag"))
        print(f"bank {bank}   {len(bank_rows)} loans   {escalated} escalated")

        for row in bank_rows:
            loan = str(row.get("loan_id"))
            risk = str(row.get("computed_risk_class"))
            esc = bool(row.get("escalation_flag"))
            ids = answered_questions(row)

            should_escalate = risk in ESCALATING
            rule_ok = esc == should_escalate
            # Only judge Annex 5 completeness on rows that have a snapshot;
            # a screening can legitimately predate the checklist entirely.
            annex_ok = (not ids) or (
                len(ids) == EXPECTED_ANSWERS and REQUIRED_QUESTION in ids
            )

            derived = derive_risk(row.get("esdd_snapshot"), sections)
            derive_ok = derived is None or derived == risk

            mark = "ok " if (rule_ok and annex_ok and derive_ok) else "BAD"
            shown = risk if derive_ok else f"{risk}!={derived}"
            print(
                f"  [{mark}] {loan:<16} {shown:<16} esc={str(esc):<5} "
                f"answers={len(ids):<3} has_1.4={REQUIRED_QUESTION in ids}"
            )
            if not derive_ok:
                failures.append(
                    f"{loan}: stored risk '{risk}' but the answers derive "
                    f"'{derived}' -- the rating is asserted, not computed"
                )

            if not rule_ok:
                if should_escalate:
                    failures.append(
                        f"{loan}: risk={risk} must escalate (s7.3.6) but flag is false"
                    )
                else:
                    failures.append(
                        f"{loan}: risk={risk} must NOT escalate but flag is true"
                    )
            if ids and not annex_ok:
                failures.append(
                    f"{loan}: {len(ids)} Annex 5 answers, expected {EXPECTED_ANSWERS} "
                    f"(has_1.4={REQUIRED_QUESTION in ids}) -- pre-P46 snapshot"
                )
        print()

    if failures:
        print("FAILED:")
        for f in failures:
            print(f"  - {f}")
        print()
        print("If snapshots are short, the image that seeded predates P46:")
        print("     ./run_demo.sh          # full rebuild, then re-seed")
        return 1

    print("PASS - Supabase Cloud data matches the P46 rules.")
    print("The hosted demo reads these same rows, so it is current too.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
