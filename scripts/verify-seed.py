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

# What P46 expects to find in the database.
EXPECTED_ESCALATED = 4          # MEDIUM and HIGH both escalate (NRB ESRM 2022 s7.3.6)
EXPECTED_ANSWERS = 13           # Annex 5 gained Q1.4 (land acquisition / resettlement)
REQUIRED_QUESTION = "annex5.1.4"

TABLE = "bfi_esrm_screenings"
COLUMNS = "loan_id,computed_risk_class,escalation_flag,esdd_snapshot"


def fetch():
    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base or not key:
        sys.exit(
            "ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.\n"
            "Run:  set -a; source .env.local; set +a"
        )
    url = f"{base.rstrip('/')}/rest/v1/{TABLE}?select={COLUMNS}"
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


def question_ids(row):
    """Pull the set of answered questionIds out of esdd_snapshot.

    The snapshot has been stored both as a bare list of responses and as an
    object with a `responses` key, so handle both rather than assuming.
    """
    snap = row.get("esdd_snapshot") or {}
    if isinstance(snap, list):
        responses = snap
    elif isinstance(snap, dict):
        responses = snap.get("responses", [])
    else:
        responses = []
    if not isinstance(responses, list):
        return set()
    return {r.get("questionId") for r in responses if isinstance(r, dict)}


def main():
    rows = fetch()
    escalated = sum(1 for r in rows if r.get("escalation_flag"))

    print(f"screenings: {len(rows)}   escalated: {escalated}")
    print()

    failures = []

    for row in sorted(rows, key=lambda r: str(r.get("loan_id"))):
        ids = question_ids(row)
        has_required = REQUIRED_QUESTION in ids
        loan = str(row.get("loan_id"))
        risk = str(row.get("computed_risk_class"))
        esc = str(row.get("escalation_flag"))
        mark = "ok " if (len(ids) == EXPECTED_ANSWERS and has_required) else "BAD"
        print(
            f"  [{mark}] {loan:<16} {risk:<8} esc={esc:<5} "
            f"answers={len(ids):<3} has_1.4={has_required}"
        )
        if ids and not has_required:
            failures.append(f"{loan}: missing {REQUIRED_QUESTION} (pre-P46 snapshot)")

        # A MEDIUM or HIGH screening that is not flagged contradicts s7.3.6.
        if risk in ("medium", "high", "extreme") and not row.get("escalation_flag"):
            failures.append(f"{loan}: risk={risk} but escalation_flag is false")

    print()
    if escalated != EXPECTED_ESCALATED:
        failures.append(
            f"escalated count is {escalated}, expected {EXPECTED_ESCALATED}"
        )

    if failures:
        print("FAILED:")
        for f in failures:
            print(f"  - {f}")
        print()
        print("Fix: rebuild so the image carries the P46 code, then re-seed:")
        print("     ./run_demo.sh          # no --no-build")
        return 1

    print("PASS - Supabase Cloud data matches the P46 rules.")
    print("The hosted demo reads these same rows, so it is current too.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
