# Offline Demo Stack

Zero-internet Docker Compose stack for the Nepal BFI demo. Runs Postgres +
PostgREST + the Next.js web app on an internal Docker network so the entire
demo works with the host machine completely disconnected from the internet.

The regular `docker-compose.yml` (points at Supabase Cloud + Jana API) is
untouched. Offline mode is a completely separate compose file.

---

## Boot

```bash
# 1) Build the images (needs internet the FIRST time to pull postgres,
#    postgrest, node-alpine, and npm deps).
docker compose -f docker-compose.offline.yml build

# 2) Bring the stack up.
docker compose -f docker-compose.offline.yml up -d

# 3) Wait ~10s for postgres to run every script under docker/postgres/initdb.d/,
#    then seed the demo data. Export SEED_ADMIN_TOKEN in your shell first
#    (same variable your dev workflow already uses); the compose file passes
#    it through automatically.
export SEED_ADMIN_TOKEN=<your-token-here>   # skip if already in your shell profile

# ORDER MATTERS — each step depends on the previous:
# seed-officers writes bfi_officers rows that seed-demo-data's ESDD/CAP
# writes have a foreign key to; seed writes the loan book that ESDD
# responses attach to. Reversing the order will fail with FK violations.
curl -X POST "http://localhost:3001/api/admin/seed-officers?token=$SEED_ADMIN_TOKEN"
curl -X POST "http://localhost:3001/api/admin/seed?token=$SEED_ADMIN_TOKEN"
curl -X POST "http://localhost:3001/api/admin/seed-demo-data?token=$SEED_ADMIN_TOKEN"

# 4) Open the app.
open http://localhost:3001
```

## Reset (wipe the database)

```bash
docker compose -f docker-compose.offline.yml down -v
```

The `-v` is the important bit — without it, the named volume `bfi_demo_pgdata`
survives and postgres will skip the `docker-entrypoint-initdb.d` scripts on
the next boot. **Always use `-v` when you want a clean database.**

## Ports

| Host port | Container      | Purpose                                        |
|-----------|----------------|------------------------------------------------|
| 3001      | web:3000       | Next.js app (open this in a browser)           |
| 3010      | postgrest:3000 | Direct PostgREST access for debugging / curl   |
| 5432      | postgres:5432  | Direct Postgres access for psql debugging      |

Both `3010` and `5432` are debugging-only exposures. The web container talks
to PostgREST as `http://postgrest:3000` over the private compose network; the
`3010` mapping is only there for host-side inspection with curl. If you want
a properly locked-down demo laptop, comment those two `ports:` blocks out.

## Verifying air-gap

The build step needs internet the FIRST time to pull images and install
npm deps. Once built, verify the running stack is air-gapped:

```bash
# 1) Turn off your host's wifi + unplug ethernet.
# 2) docker compose -f docker-compose.offline.yml down -v
# 3) docker compose -f docker-compose.offline.yml up -d
# 4) Run the seed curls above.
# 5) Click through the demo end to end.
```

If any request fails DNS resolution, either the app has a call that wasn't
mocked out or the compose file leaked an internet-dependent env var — check
the container logs.

## What's inside the DB on first boot

Postgres runs `docker/postgres/initdb.d/*.sql` in lexical order:

1. `00-init-roles.sql` — creates the `anon`, `authenticated`, `service_role`
   roles that Supabase would create for you but bare Postgres doesn't. Also
   enables `pgcrypto` + `pg_trgm`.
2. `10-schema.sql` through `90-tenant-settings.sql` — verbatim copies of
   `scripts/supabase-*.sql`, renamed so the dependency order (banks + officers
   before every capture table that FKs into them) is enforced numerically.
3. `99-post-schema.sql` — belt-and-suspenders GRANTs on all public objects
   + `ALTER DEFAULT PRIVILEGES` so future migrations inherit the same posture.

## JWT tokens

The two Supabase-format JWTs baked into `docker-compose.offline.yml` were
signed HS256 with `bfi-demo-offline-postgrest-jwt-secret-do-not-use-in-prod-32ch`.

- Anon:         `{"role": "anon"}`
- Service role: `{"role": "service_role"}`

Regenerate them from a shell with Node:

```bash
node -e '
const c = require("crypto");
const secret = "bfi-demo-offline-postgrest-jwt-secret-do-not-use-in-prod-32ch";
const b64 = x => Buffer.from(x).toString("base64").replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
const sign = payload => {
  const data = b64(JSON.stringify({alg:"HS256",typ:"JWT"})) + "." + b64(JSON.stringify(payload));
  return data + "." + b64(c.createHmac("sha256", secret).update(data).digest());
};
console.log("anon:",         sign({role: "anon"}));
console.log("service_role:", sign({role: "service_role"}));'
```

If you change the secret in the compose file, you MUST regenerate both
tokens and paste them into the `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` env vars of the `web` service.

## Not offline yet — known caveats

- **Facility map tiles** (`components/bfi/shared/facility-map-inner.tsx`)
  fetch tiles from `https://{s}.basemaps.cartocdn.com/...` at render time.
  This affects the Facility Emissions panel only; the rest of the demo
  works fine. Either bundle the tiles (see the Leaflet docs for tile-server
  self-hosting) or accept the map will render blank when air-gapped.
