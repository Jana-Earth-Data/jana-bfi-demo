# Jana BFI Demo

Sales-demo dashboard for Jana Earth Data's financed-emissions product, scoped to Nepal's commercial banking sector. Shows a loan officer's view of a fictional bank's portfolio against Nepal Rastra Bank's three regulatory frameworks (ESRM 2018, Green Finance Taxonomy 2024, NFRS 2026–27), with PCAF Cat. 15 attribution math wired to real Climate TRACE 2024 and EDGAR data.

## Stack

- Next.js 15 / React 19 / TypeScript
- Tailwind CSS (custom dark theme)
- Recharts, Leaflet (dynamic-imported), OpenAI TTS (audio narration)
- Synthesized 80K-loan portfolio rooted in real Nepal entities (61 cement plants from GCCT, real CT 2024 facility emissions, polygon-clipped EDGAR national CO₂)

## Quick start

```bash
cp .env.local.example .env.local
npm install
npm run dev
# → http://localhost:3000
```

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Jana API base URL (default `https://api-test.jana.earth`) |
| `NEXT_PUBLIC_AUTH_URL` | Jana auth service for the device-code flow (default `https://auth-dev.jana.earth`) |
| `NEXT_PUBLIC_DEMO_USE_MOCKS` | `true` forces mock mode; `false` enables the live overlay after sign-in |

`tts.key` is a separate local-only file holding the OpenAI API key used by `scripts/generate-tour-audio.py` to (re)generate the guided-tour MP3s. It's gitignored and must not be committed.

## Deploy to Vercel

This project is auto-detected as Next.js — no manual config is required beyond environment variables.

1. Push the repo to GitHub (or your preferred git host).
2. In the Vercel dashboard, **Import Project** → select the repo.
3. Add the three environment variables above under **Settings → Environment Variables**.
4. Click **Deploy**. First build takes ~2 minutes; subsequent builds are incremental.

The committed `vercel.json` pins the build region to `iad1` (US East) and disables silent-deploy commit comments. `.vercelignore` keeps raw data CSVs, the Dockerfile, dev scripts, and docs out of the build artifact — only the `data/*.json` snapshots, the audio MP3s, and the app code ship.

## Deploy via Docker (alternative)

```bash
docker compose up --build
# → http://localhost:3001
```

The included `Dockerfile` does a multi-stage build with Next.js standalone output and ships a minimal `node:20-alpine` runner. Used by the ECR/ECS path in `.github/workflows/`.

## Regenerating data snapshots

If GCCT, Climate TRACE, EDGAR, or the curated industrial list changes:

```bash
python3 scripts/build-data-snapshots.py
```

This rebuilds `data/{cement-plants,hydropower-operators,industrial-entities,ct-nepal-2024,edgar-nepal-2024}-npl.json` from the raw CSVs/GeoJSON staged in `data/_raw_*` and the GCCT xlsx in `~/Downloads/`.

## Regenerating tour audio

```bash
python3 scripts/generate-tour-audio.py            # incremental (skips existing)
python3 scripts/generate-tour-audio.py --force    # full regen
python3 scripts/generate-tour-audio.py --step closing --force   # one step
```

Requires `tts.key` (OpenAI API key) in the repo root. Output → `public/audio/tour-*.mp3`.
