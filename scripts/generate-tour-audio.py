#!/usr/bin/env python3
"""
Generate tour-narration MP3s using OpenAI's TTS API.

Reads:
  - data/tour-script.json           (the steps + narration text)
  - tts.key                          (OpenAI API key, gitignored)

Writes:
  - public/audio/tour-NN-id.mp3      (one file per step)

The script is idempotent: existing files are skipped unless --force is passed.

Usage:
  python3 scripts/generate-tour-audio.py
  python3 scripts/generate-tour-audio.py --force        # regenerate all
  python3 scripts/generate-tour-audio.py --voice nova   # override voice
  python3 scripts/generate-tour-audio.py --step closing # regenerate one step
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT_PATH = REPO_ROOT / "data" / "tour-script.json"
KEY_PATH = REPO_ROOT / "tts.key"
OUTPUT_DIR = REPO_ROOT / "public" / "audio"


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


def synthesize(text: str, voice: str, model: str, api_key: str) -> bytes:
    """Call OpenAI /v1/audio/speech and return the MP3 bytes."""
    payload = json.dumps(
        {
            "model": model,
            "voice": voice,
            "input": text,
            "response_format": "mp3",
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        if resp.status != 200:
            raise RuntimeError(f"OpenAI TTS returned status {resp.status}")
        return resp.read()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate all step audio even if files already exist.",
    )
    parser.add_argument(
        "--voice",
        default=None,
        help="Override the voice (default: from tour-script.json).",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Override the model (default: from tour-script.json).",
    )
    parser.add_argument(
        "--step",
        default=None,
        help="Regenerate only the step with this id (e.g. 'closing').",
    )
    args = parser.parse_args()

    if not SCRIPT_PATH.exists():
        sys.exit(f"ERROR: {SCRIPT_PATH} not found.")
    script = json.loads(SCRIPT_PATH.read_text())
    steps = script.get("steps", [])
    if not steps:
        sys.exit("ERROR: no steps in tour-script.json")

    voice = args.voice or script.get("voice", "onyx")
    model = args.model or script.get("model", "tts-1-hd")
    api_key = read_key()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Voice: {voice} · Model: {model} · {len(steps)} steps")
    print(f"Output: {OUTPUT_DIR}")
    print()

    generated = 0
    skipped = 0
    for i, step in enumerate(steps, start=1):
        step_id = step.get("id", f"step-{i}")
        if args.step and args.step != step_id:
            continue
        audio_path_rel = step.get("audioFile", "")
        # Strip leading slash and normalise to public-relative
        rel = audio_path_rel.lstrip("/")
        # Allow "audio/foo.mp3" or "/audio/foo.mp3"
        if rel.startswith("audio/"):
            out_path = REPO_ROOT / "public" / rel
        else:
            out_path = OUTPUT_DIR / f"tour-{i:02d}-{step_id}.mp3"

        if out_path.exists() and not args.force and not args.step:
            print(f"  [{i:02d}] {step_id}: skipped (exists)")
            skipped += 1
            continue

        text = step.get("narration", "").strip()
        if not text:
            print(f"  [{i:02d}] {step_id}: WARN — no narration text, skipping")
            continue

        print(f"  [{i:02d}] {step_id}: generating ({len(text)} chars)...", end="", flush=True)
        try:
            mp3 = synthesize(text, voice, model, api_key)
        except Exception as exc:  # noqa: BLE001 - we want any failure here
            print(f" FAILED: {exc}")
            return 1

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(mp3)
        size_kb = len(mp3) // 1024
        print(f" wrote {out_path.name} ({size_kb} KB)")
        generated += 1

    print()
    print(f"Done. Generated {generated}, skipped {skipped}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
