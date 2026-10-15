"""Generates every voice line with Chatterbox (open-source AI voices, MIT).

Each character's voice is copied from tools/refs/<character>.wav (made by
tools/make_refs.py), and every line gets an emotion level based on who is
speaking and how (shouting, whispering, crying).

Usage:
  python tools/make_voices.py [--out voices] [--worker 0 --workers 1] [--all]

Reads voices/manifest.json (made by tools/extract-lines.mjs). Lines that
already have a file are skipped unless --all is given. Run several workers
side by side to use more of the CPU.
"""
import argparse
import json
import re
import time
import zlib
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from chatterbox.tts import ChatterboxTTS

ROOT = Path(__file__).resolve().parent.parent
REFS = ROOT / "tools" / "refs"


def speakable(text: str) -> str:
    t = text.replace("“", "").replace("”", "").replace("—", ", ").replace("…", "...")
    t = re.sub(r"\bSt\.", "Saint", t)
    t = re.sub(r"\b4B\b", "four B", t)
    t = re.sub(r"\b[A-Z]{2,}\b", lambda m: m.group(0).capitalize(), t)
    t = t.strip()
    if t and t[-1] not in ".!?,":
        t += "..."          # lines that get cut off
    return t


def emotion(who: str, text: str):
    """(exaggeration, cfg_weight). Higher exaggeration = more dramatic;
    lower cfg = slower, more deliberate pacing."""
    ex, cfg = {
        "teodor": (0.45, 0.35), "rhee": (0.4, 0.55), "voices": (0.3, 0.4), "you": (0.45, 0.5),
        "lena": (0.5, 0.45), "daniel": (0.45, 0.45), "harold": (0.55, 0.4), "ivy": (0.6, 0.5),
        "jun": (0.6, 0.5), "mara": (0.55, 0.5), "radio94": (0.35, 0.55), "dana": (0.6, 0.5),
    }.get(who, (0.5, 0.5))
    if re.search(r"\b[A-Z]{2,}\b", text) or "!" in text:
        ex, cfg = 0.9, 0.3                           # shouting
    if re.search(r"oh god|no, no|please|i'm sorry|i missed you|that's my kid", text, re.I):
        ex = max(ex, 0.75)                           # pleading, crying
    return ex, cfg


def shape(samples: np.ndarray, rate: int) -> np.ndarray:
    loud = np.where(np.abs(samples) > 0.015)[0]
    if len(loud):
        samples = samples[max(0, loud[0] - int(0.04 * rate)): min(len(samples), loud[-1] + int(0.15 * rate))]
    rms = np.sqrt(np.mean(samples ** 2)) or 1.0
    samples = samples * (0.1 / rms)
    peak = np.max(np.abs(samples)) or 1.0
    if peak > 0.95:
        samples = samples * (0.95 / peak)
    return samples.astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "voices"))
    ap.add_argument("--worker", type=int, default=0)
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--threads", type=int, default=0)
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    if args.threads:
        torch.set_num_threads(args.threads)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / "voices" / "manifest.json").read_text(encoding="utf-8"))
    lines = [l for i, l in enumerate(manifest["lines"]) if i % args.workers == args.worker]
    if not args.all:
        lines = [l for l in lines if not (out / f"{l['id']}.mp3").exists()]
    # longest lines first, so the workers finish around the same time
    lines.sort(key=lambda l: -len(l["text"]))
    print(f"worker {args.worker}: {len(lines)} lines", flush=True)
    model = ChatterboxTTS.from_pretrained(device="cpu")
    started = time.time()
    audio = 0.0
    for n, line in enumerate(lines, 1):
        ref = REFS / f"{line['who']}.wav"
        ex, cfg = emotion(line["who"], line["text"])
        torch.manual_seed(zlib.crc32(line["id"].encode()))
        wav = model.generate(speakable(line["text"]), audio_prompt_path=str(ref), exaggeration=ex, cfg_weight=cfg)
        samples = shape(wav.squeeze(0).numpy(), model.sr)
        sf.write(out / f"{line['id']}.mp3", samples, model.sr, format="MP3")
        audio += len(samples) / model.sr
        if n % 10 == 0 or n == len(lines):
            print(f"worker {args.worker}: {n}/{len(lines)}  {audio / 60:.1f} min audio  {(time.time() - started) / 60:.1f} min", flush=True)


if __name__ == "__main__":
    main()
