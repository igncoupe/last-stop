"""Recorded-sounding effects for the game (the jumpscares, the payphone, the hospital door), made with ElevenLabs
sound generation from the descriptions in tools/sfx-elevenlabs.json.

  python tools/make_sfx_elevenlabs.py            # make whatever's missing in sfx/
  python tools/make_sfx_elevenlabs.py --redo X   # make X again

The API key is read from ~/.elevenlabs_key (never from this repo, never printed), as make_voices_elevenlabs.py does.
Each one comes out as sfx/<name>.mp3; the game loads them on demand.
"""
import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIST = ROOT / "tools" / "sfx-elevenlabs.json"
OUT = ROOT / "sfx"
KEY_FILE = Path.home() / ".elevenlabs_key"
API = "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128"


def key():
    if not KEY_FILE.exists():
        raise SystemExit(f"no ElevenLabs key at {KEY_FILE}")
    return KEY_FILE.read_text().strip()


def make(name, seconds, prompt):
    body = json.dumps({"text": prompt, "duration_seconds": seconds, "prompt_influence": 0.55}).encode()
    for attempt in range(4):
        req = urllib.request.Request(API, data=body, method="POST",
                                     headers={"xi-api-key": key(), "Content-Type": "application/json", "Accept": "audio/mpeg"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            if len(data) < 2000:
                raise RuntimeError(f"short reply ({len(data)} bytes)")
            (OUT / f"{name}.mp3").write_bytes(data)
            return len(data)
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(4 * (attempt + 1))
                continue
            raise SystemExit(f"{name}: HTTP {e.code}: {msg}")
    raise SystemExit(f"{name}: gave up")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--redo", nargs="*", default=[])
    args = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    sounds = {k: v for k, v in json.loads(LIST.read_text(encoding="utf-8")).items() if not k.startswith("_")}
    for name, (seconds, prompt) in sounds.items():
        if (OUT / f"{name}.mp3").exists() and name not in args.redo:
            continue
        size = make(name, seconds, prompt)
        print(f"{name}: {size} bytes", flush=True)


if __name__ == "__main__":
    main()
