#!/usr/bin/env bash
# ============================================================================
# run_demo.sh — one-command boot for the Nepal BFI demo
# ============================================================================
# Usage:
#   ./run_demo.sh              # dev mode: docker-compose.yml + Supabase Cloud
#   ./run_demo.sh --offline    # offline: bundled Postgres+PostgREST+nginx
#
# Flags:
#   --offline    Use docker-compose.offline.yml (zero-internet stack)
#   --fresh      Wipe the postgres volume before boot (offline only)
#   --no-build   Skip the image rebuild
#   --no-seed    Skip the seed step (leave the DB empty)
#   -h, --help   Print this help
#
# Requires:
#   * Docker Desktop running
#   * SEED_ADMIN_TOKEN exported in your shell (dev mode)
#     Offline mode falls back to a compose-hardcoded default if not set.
# ============================================================================

set -euo pipefail

# ----- Argument parsing ------------------------------------------------------
OFFLINE=0
FRESH=0
BUILD=1
SEED=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --offline)  OFFLINE=1; shift ;;
    --fresh)    FRESH=1; shift ;;
    --no-build) BUILD=0; shift ;;
    --no-seed)  SEED=0; shift ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "ERROR: unknown flag: $1" >&2
      echo "Run '$0 --help' for usage." >&2
      exit 2
      ;;
  esac
done

# ----- Config ----------------------------------------------------------------
if [[ "$OFFLINE" == "1" ]]; then
  COMPOSE_FILE="docker-compose.offline.yml"
  MODE_LABEL="OFFLINE (bundled Postgres + PostgREST + nginx)"
  # Offline binds 3002 so it can run alongside the dev stack on 3001.
  WEB_PORT=3002
  # Fall back to the compose default when SEED_ADMIN_TOKEN isn't in the shell
  TOKEN="${SEED_ADMIN_TOKEN:-offline-demo-seed-token}"
else
  COMPOSE_FILE="docker-compose.yml"
  MODE_LABEL="DEV (Supabase Cloud)"
  WEB_PORT=3001
  # Dev mode has no default — you must have SEED_ADMIN_TOKEN in your shell
  if [[ -z "${SEED_ADMIN_TOKEN:-}" ]]; then
    echo "ERROR: SEED_ADMIN_TOKEN is not set in your shell." >&2
    echo "Export it first (matches your dev docker-compose.yml env)." >&2
    exit 3
  fi
  TOKEN="$SEED_ADMIN_TOKEN"
fi

cd "$(dirname "$0")"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: $COMPOSE_FILE not found in $(pwd)" >&2
  exit 4
fi

COMPOSE="docker compose -f $COMPOSE_FILE"

echo ""
echo "============================================================"
echo "  Jana BFI Demo — $MODE_LABEL"
echo "  Compose file: $COMPOSE_FILE"
echo "  Web port:     $WEB_PORT"
echo "============================================================"
echo ""

# ----- Optional volume wipe (fresh init) -------------------------------------
if [[ "$FRESH" == "1" ]]; then
  if [[ "$OFFLINE" != "1" ]]; then
    echo "NOTE: --fresh has no effect in dev mode (Supabase Cloud is the source of truth)."
  else
    echo "→ Wiping postgres volume (fresh init on next boot)…"
    $COMPOSE down -v --remove-orphans
  fi
fi

# ----- Build + up ------------------------------------------------------------
if [[ "$BUILD" == "1" ]]; then
  echo "→ Building images…"
  $COMPOSE build
fi

echo "→ Bringing the stack up…"
$COMPOSE up -d

# ----- Wait for the web app to answer ----------------------------------------
echo "→ Waiting for web app to become reachable (up to 90s)…"
WEB_URL="http://localhost:${WEB_PORT}"
for i in {1..45}; do
  if curl -fsS -o /dev/null "$WEB_URL"; then
    echo "  web app up after ${i}x2s"
    break
  fi
  if [[ "$i" == "45" ]]; then
    echo "  ERROR: web app did not become reachable at $WEB_URL after 90s." >&2
    echo "  Check logs: $COMPOSE logs web | tail -50" >&2
    exit 5
  fi
  sleep 2
done

# ----- Seed sequence ---------------------------------------------------------
if [[ "$SEED" == "1" ]]; then
  echo ""
  echo "→ Seeding demo data (order matters: officers → loan book → demo state)…"

  seed_step() {
    local label="$1"
    local path="$2"
    echo "  · $label"
    local http_code
    http_code=$(curl -sS -o /tmp/run_demo_seed_last.json -w "%{http_code}" \
      -X POST "${WEB_URL}${path}?token=${TOKEN}")
    if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
      echo ""
      echo "  ERROR: $label failed (HTTP $http_code):" >&2
      cat /tmp/run_demo_seed_last.json >&2 || true
      echo "" >&2
      exit 6
    fi
  }

  seed_step "seed-officers"    "/api/admin/seed-officers"
  seed_step "seed"             "/api/admin/seed"
  seed_step "seed-demo-data"   "/api/admin/seed-demo-data"

  echo "  ✔ Seed complete."
else
  echo "→ Skipping seed step (--no-seed)."
fi

# ----- Done ------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  Ready. Open $WEB_URL in your browser."
echo "============================================================"
if [[ "$OFFLINE" == "1" ]]; then
  cat <<'EOF'

  Offline mode notes:
    * Air-gap verification: disable wifi/ethernet, re-navigate the app.
    * Debug ports: postgrest at :3010, gateway at :3020, postgres at :5432.
    * Reset:  ./run_demo.sh --offline --fresh

EOF
fi
