#!/usr/bin/env python3
"""
Generate tour-narration MP3s using OpenAI's TTS API.

Directory model (v2 — per-tenant, per-tour):

  data/tour-scripts/<tenantId>/<tourName>.json
  public/audio/<tenantId>/<tourName>/tour-NN-<step-id>.mp3

Where:
  <tenantId>  matches lib/tenants/registry.ts (e.g. "default", "laxmi_sunrise")
  <tourName>  is one of "dashboard", "loan-officer", "manager"

Reads:
  - tts.key   (OpenAI API key, gitignored)

The script is idempotent: existing files are skipped unless --force is
passed. Individual steps can be regenerated with --step.

Usage:
  # Regenerate all steps for one tour of one tenant:
  python3 scripts/generate-tour-audio.py --tenant laxmi_sunrise --tour dashboard --force

  # Regenerate one specific step of one tour:
  python3 scripts/generate-tour-audio.py --tenant laxmi_sunrise --tour dashboard --step closing

  # Regenerate every tour for a tenant:
  python3 scripts/generate-tour-audio.py --tenant laxmi_sunrise --all-tours --force

  # Regenerate every tenant × every tour (rare; onboarding new prospect):
  python3 scripts/generate-tour-audio.py --all-tenants --all-tours --force

  # Override voice / model:
  python3 scripts/generate-tour-audio.py --tenant laxmi_sunrise --tour dashboard --voice nova
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_ROOT = REPO_ROOT / "data" / "tour-scripts"
AUDIO_ROOT = REPO_ROOT / "public" / "audio"
KEY_PATH = REPO_ROOT / "tts.key"

# Known tour names. If more are added, list them here so --all-tours picks
# them up. Kept in sync with tour-context.tsx.
KNOWN_TOURS = ("dashboard", "loan-officer", "manager")

# Transient errors we should retry. OpenAI TTS occasionally returns a
# TLS EOF mid-handshake, a socket reset, or a 5xx. Retrying with backoff
# clears these up ~95% of the time.
_TRANSIENT_ERROR_MARKERS = (
    "EOF occurred in violation of protocol",
    "SSLEOFError",
    "Connection reset",
    "timed out",
    "Bad gateway",
    "Service Unavailable",
    "Gateway Timeout",
)

MAX_RETRIES = 4
RETRY_BASE_SECONDS = 2.0  # 2, 4, 8, 16 seconds


def read_key() -> str:
    if not KEY_PATH.exists():
        sys.exit(
            f"ERROR: {KEY_PATH} not found. Place your OpenAI API key (sk-...) "
            "in that file. It's gitignored."
        )
    key = KEY_PATH.read_text().strip()
    if not key.startswith("sk-"):
        sys.exit(
            f"ERROR: {KEY_PATH} doesn't look like an OpenAI API key "
            "(should start with 'sk-')"
        )
    return key


def _is_transient(exc: BaseException) -> bool:
    """True when the exception looks like a transient network hiccup."""
    if isinstance(exc, (urllib.error.URLError, TimeoutError)):
        return True
    msg = str(exc)
    return any(marker in msg for marker in _TRANSIENT_ERROR_MARKERS)


def synthesize(text: str, voice: str, model: str, api_key: str) -> bytes:
    """Call OpenAI /v1/audio/speech and return the MP3 bytes.

    Retries transient failures (TLS EOF, timeouts, 5xx) up to MAX_RETRIES
    times with exponential backoff. Non-transient errors (auth, bad
    request) raise immediately without retry.
    """
    payload = json.dumps(
        {
            "model": model,
            "voice": voice,
            "input": text,
            "response_format": "mp3",
        }
    ).encode("utf-8")

    last_exc: BaseException | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        req = urllib.request.Request(
            "https://api.openai.com/v1/audio/speech",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"OpenAI TTS returned status {resp.status}")
                return resp.read()
        except Exception as exc:  # noqa: BLE001 - retry logic wants any error
            last_exc = exc
            if not _is_transient(exc) or attempt == MAX_RETRIES:
                raise
            backoff = RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            print(
                f" retry {attempt}/{MAX_RETRIES - 1} in {backoff:.0f}s ({exc.__class__.__name__})...",
                end="",
                flush=True,
            )
            time.sleep(backoff)

    # Unreachable — the loop either returns or re-raises. Kept for type-checker peace.
    assert last_exc is not None
    raise last_exc


def discover_tenants() -> list[str]:
    """List tenant folders under data/tour-scripts/."""
    if not SCRIPTS_ROOT.exists():
        return []
    return sorted(
        p.name for p in SCRIPTS_ROOT.iterdir() if p.is_dir()
    )


def discover_tours(tenant: str) -> list[str]:
    """List tour JSON files under data/tour-scripts/<tenant>/."""
    tenant_dir = SCRIPTS_ROOT / tenant
    if not tenant_dir.exists():
        return []
    return sorted(
        p.stem for p in tenant_dir.glob("*.json") if p.is_file()
    )


def generate_one_tour(
    tenant: str,
    tour: str,
    api_key: str,
    voice_override: str | None,
    model_override: str | None,
    force: bool,
    only_step: str | None,
    failures: list[str],
) -> tuple[int, int]:
    """Generate audio for a single (tenant, tour). Returns (generated, skipped).

    A per-step failure is logged into `failures` and does NOT abort the
    tour or the outer run. This lets a single flaky TLS handshake take
    out one step without wasting the API calls that already succeeded.
    """
    script_path = SCRIPTS_ROOT / tenant / f"{tour}.json"
    if not script_path.exists():
        print(f"  SKIP {tenant}/{tour}: script not found at {script_path}")
        return (0, 0)

    script = json.loads(script_path.read_text())
    steps = script.get("steps", [])
    if not steps:
        print(f"  SKIP {tenant}/{tour}: no steps in script")
        return (0, 0)

    voice = voice_override or script.get("voice", "onyx")
    model = model_override or script.get("model", "tts-1-hd")

    out_dir = AUDIO_ROOT / tenant / tour
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n=== {tenant}/{tour} ({voice} · {model} · {len(steps)} steps) ===")
    print(f"    Output: {out_dir}")

    generated = 0
    skipped = 0
    for i, step in enumerate(steps, start=1):
        step_id = step.get("id", f"step-{i}")
        if only_step and only_step != step_id:
            continue

        # File name is derived from position + step id so the filename
        # stays stable across script edits that don't renumber steps.
        # The script's audioFile path is authoritative; if present, use it.
        audio_path_rel = step.get("audioFile", "")
        if audio_path_rel:
            rel = audio_path_rel.lstrip("/")
            out_path = REPO_ROOT / "public" / rel if rel.startswith("audio/") else out_dir / Path(audio_path_rel).name
        else:
            out_path = out_dir / f"tour-{i:02d}-{step_id}.mp3"

        if out_path.exists() and not force and not only_step:
            print(f"  [{i:02d}] {step_id}: skipped (exists)")
            skipped += 1
            continue

        text = step.get("narration", "").strip()
        if not text:
            print(f"  [{i:02d}] {step_id}: WARN — no narration text, skipping")
            continue

        print(
            f"  [{i:02d}] {step_id}: generating ({len(text)} chars)...",
            end="",
            flush=True,
        )
        try:
            mp3 = synthesize(text, voice, model, api_key)
        except Exception as exc:  # noqa: BLE001 - we log and continue
            print(f" FAILED: {exc}")
            failures.append(f"{tenant}/{tour}#{step_id}: {exc}")
            continue

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(mp3)
        size_kb = len(mp3) // 1024
        print(f" wrote {out_path.name} ({size_kb} KB)")
        generated += 1

    return (generated, skipped)


def resolve_targets(
    args: argparse.Namespace,
) -> Iterable[tuple[str, str]]:
    """Iterate the (tenant, tour) pairs the args select."""
    tenants: list[str]
    if args.all_tenants:
        tenants = discover_tenants()
        if not tenants:
            sys.exit(
                f"ERROR: no tenants found under {SCRIPTS_ROOT}. "
                "Expected e.g. data/tour-scripts/default/dashboard.json"
            )
    elif args.tenant:
        tenants = [args.tenant]
    else:
        sys.exit("ERROR: pass --tenant <id> or --all-tenants")

    for tenant in tenants:
        if args.all_tours:
            tours = discover_tours(tenant)
            if not tours:
                print(f"  SKIP {tenant}: no tour scripts under it")
                continue
        elif args.tour:
            tours = [args.tour]
        else:
            sys.exit("ERROR: pass --tour <name> or --all-tours")

        for tour in tours:
            yield (tenant, tour)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant", default=None, help="Tenant id (e.g. 'laxmi_sunrise').")
    parser.add_argument(
        "--all-tenants", action="store_true", help="Regenerate for every tenant."
    )
    parser.add_argument("--tour", default=None, help="Tour name (e.g. 'dashboard').")
    parser.add_argument(
        "--all-tours", action="store_true", help="Regenerate every tour for the chosen tenant(s)."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate all step audio even if files already exist.",
    )
    parser.add_argument(
        "--voice",
        default=None,
        help="Override the voice (default: from the tour script).",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Override the model (default: from the tour script).",
    )
    parser.add_argument(
        "--step",
        default=None,
        help="Regenerate only the step with this id (e.g. 'closing').",
    )
    args = parser.parse_args()

    api_key = read_key()

    total_gen = 0
    total_skip = 0
    failures: list[str] = []
    for tenant, tour in resolve_targets(args):
        g, s = generate_one_tour(
            tenant=tenant,
            tour=tour,
            api_key=api_key,
            voice_override=args.voice,
            model_override=args.model,
            force=args.force,
            only_step=args.step,
            failures=failures,
        )
        total_gen += g
        total_skip += s

    print()
    print(f"Done. Generated {total_gen}, skipped {total_skip}, failed {len(failures)}.")
    if failures:
        print("\nFailed steps (re-run with --step <id> after inspecting):")
        for line in failures:
            print(f"  - {line}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
