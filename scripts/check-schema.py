#!/usr/bin/env python3
"""
Verify the target database actually has every table and column the app queries.

Why this exists
---------------
P45 added `bfi_loan_assignments.loan_category_override`. The offline stack
picks it up automatically from docker/postgres/initdb.d/, but Supabase needs
scripts/supabase-loan-category-override.sql run by hand. On the hosted demo
it never was.

The consequence was not an error. The officer-queue selected that column
alongside loan_id and officer_id, so the whole select failed, the result was
destructured as `{ data }` with the error discarded, and every loan silently
looked unassigned -- owned loans vanished from "My loans" and reappeared under
"Available to claim". No error surfaced anywhere. It went unnoticed for weeks
because the offline stack, where all the testing happened, had the column.

Two environments, one applied automatically and one by hand, with nothing
comparing them. This script is the comparison.

How it works
------------
The expected schema is derived FROM THE SOURCE, not from a list maintained
alongside it. A hand-written list is just a second thing to forget to update.
It scans app/ and lib/ for supabase query chains:

    .from("bfi_loan_assignments").select("loan_id, officer_id, ...")

and probes each table/column set against PostgREST with limit=0. When a
combined probe fails it retries column by column, so the output names the
specific column rather than the whole select.

Limits, stated honestly: this sees only literal .select() strings. Dynamic
selects, `*`, and columns touched solely by .insert()/.update()/.eq() are not
covered. It catches the class of bug described above, not every schema
difference.

Usage
-----
    set -a; source .env.local; set +a
    python3 scripts/check-schema.py

    # or against the offline stack
    NEXT_PUBLIC_SUPABASE_URL=http://localhost:3020 \\
    SUPABASE_SERVICE_ROLE_KEY=<offline service_role jwt> \\
    python3 scripts/check-schema.py

Exit codes: 0 = schema satisfies every query found, 1 = something is missing.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCAN_DIRS = ["app", "lib", "components"]

# .from("table") ... .select("cols")  -- tolerant of newlines and chained
# calls in between, but stops at the next .from( so two adjacent queries
# cannot bleed into one another.
QUERY_RE = re.compile(
    r'\.from\(\s*["\'](?P<table>bfi_[a-z_]+)["\']\s*\)'
    r'(?P<between>(?:(?!\.from\().)*?)'
    r'\.select\(\s*["\'](?P<cols>[^"\']*)["\']',
    re.S,
)

# Strip PostgREST embedding/aliasing so we probe real column names only.
#   "id, borrower:bfi_borrowers(name)"  ->  ["id"]
#   "count"                             ->  []   (aggregate, not a column)
EMBED_RE = re.compile(r"[a-z_]+\s*\(")


def discover():
    """Return {table: set(columns)} from literal .select() calls in source."""
    found = defaultdict(set)
    skipped = []
    for d in SCAN_DIRS:
        root = os.path.join(REPO, d)
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [x for x in dirnames if x != "node_modules"]
            for fn in filenames:
                if not fn.endswith((".ts", ".tsx")):
                    continue
                path = os.path.join(dirpath, fn)
                try:
                    src = open(path, encoding="utf-8").read()
                except OSError:
                    continue
                for m in QUERY_RE.finditer(src):
                    table = m.group("table")
                    cols = m.group("cols")
                    rel = os.path.relpath(path, REPO)
                    if "*" in cols or not cols.strip():
                        found[table]  # register the table, no column claims
                        continue
                    if EMBED_RE.search(cols):
                        skipped.append(f"{rel}: {table} -> embedded select, columns not probed")
                        found[table]
                        continue
                    for c in cols.split(","):
                        c = c.strip()
                        if c and re.fullmatch(r"[a-z_][a-z0-9_]*", c):
                            found[table].add(c)
    return found, skipped


def probe(base, key, table, cols):
    """GET with limit=0. Returns (ok, message)."""
    sel = ",".join(sorted(cols)) if cols else "*"
    url = f"{base}/rest/v1/{table}?select={urllib.parse.quote(sel)}&limit=0"
    req = urllib.request.Request(
        url, headers={"apikey": key, "Authorization": f"Bearer {key}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=20):
            return True, ""
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        try:
            msg = json.loads(body).get("message", body)
        except json.JSONDecodeError:
            msg = body
        return False, msg.strip()
    except urllib.error.URLError as exc:
        return False, f"unreachable: {exc.reason}"


def main():
    base = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base or not key:
        sys.exit(
            "ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.\n"
            "Run:  set -a; source .env.local; set +a"
        )

    schema, skipped = discover()
    if not schema:
        sys.exit("ERROR: no supabase queries found. Has the source layout changed?")

    print(f"target: {base}")
    print(f"scanned: {', '.join(SCAN_DIRS)}")
    print(f"found: {len(schema)} tables, "
          f"{sum(len(c) for c in schema.values())} distinct columns\n")

    missing_tables, missing_columns = [], []

    for table in sorted(schema):
        cols = schema[table]
        ok, msg = probe(base, key, table, cols)
        if ok:
            print(f"  ok    {table:<32} {len(cols)} columns")
            continue

        # Distinguish absent table from absent column.
        table_ok, table_msg = probe(base, key, table, set())
        if not table_ok:
            print(f"  MISS  {table:<32} table absent")
            missing_tables.append((table, table_msg))
            continue

        bad = []
        for c in sorted(cols):
            col_ok, _ = probe(base, key, table, {c})
            if not col_ok:
                bad.append(c)
        if bad:
            print(f"  MISS  {table:<32} missing column(s): {', '.join(bad)}")
            for c in bad:
                missing_columns.append((table, c))
        else:
            # Combined probe failed but every column passed alone.
            print(f"  WARN  {table:<32} {msg}")

    if skipped:
        print("\nnot probed (embedded selects):")
        for s in skipped:
            print(f"  - {s}")

    if missing_tables or missing_columns:
        print("\nFAILED")
        for t, m in missing_tables:
            print(f"  table {t}: {m}")
            print(f"    -> run the matching scripts/supabase-*.sql for {t}")
        for t, c in missing_columns:
            print(f"  column {t}.{c} does not exist")
            print(f"    -> ALTER TABLE public.{t} ADD COLUMN IF NOT EXISTS {c} ...;")
        print("\nSQL scripts live in scripts/supabase-*.sql and are applied to")
        print("Supabase by hand. The offline stack applies")
        print("docker/postgres/initdb.d/*.sql automatically on a fresh volume,")
        print("which is why a gap here can pass every offline test.")
        return 1

    print("\nPASS - every table and column the app queries exists.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
