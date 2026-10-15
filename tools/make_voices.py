"""Generates every voice line with Kokoro (an open-source AI voice model).

Usage:
  python tools/make_voices.py <folder with kokoro-v1.0.int8.onnx + voices-v1.0.bin>

Reads voices/manifest.json (made by tools/extract-lines.mjs) and writes
voices/<id>.mp3 for every line that doesn't have one yet. Each character's
voice, speed and pitch come from js/story/cast.js.
"""
import json
import re
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
VOICES = ROOT / "voices"


def speakable(text: str) -> str:
    """Turn a subtitle into something the voice model reads well."""
    t = text.replace("“", "").replace("”", "").replace("—", ", ").replace("…", "...")
    t = re.sub(r"\bSt\.", "Saint", t)
    t = re.sub(r"\b4B\b", "four B", t)
    # ALL CAPS words get spelled out by the model, so lowercase them
    t = re.sub(r"\b[A-Z]{2,}\b", lambda m: m.group(0).capitalize(), t)
    return t.strip()


def shape(samples: np.ndarray, rate: int, pitch: float) -> np.ndarray:
    """Pitch shift by resampling, trim silence, even out loudness."""
    if abs(pitch - 1.0) > 1e-3:
        src = np.arange(len(samples))
        dst = np.arange(0, len(samples) - 1, pitch)
        samples = np.interp(dst, src, samples)
    loud = np.where(np.abs(samples) > 0.02)[0]
    if len(loud):
        start = max(0, loud[0] - int(0.03 * rate))
        end = min(len(samples), loud[-1] + int(0.12 * rate))
        samples = samples[start:end]
    rms = np.sqrt(np.mean(samples ** 2)) or 1.0
    samples = samples * (0.1 / rms)
    peak = np.max(np.abs(samples)) or 1.0
    if peak > 0.95:
        samples = samples * (0.95 / peak)
    return samples.astype(np.float32)


def main() -> None:
    models = Path(sys.argv[1])
    manifest = json.loads((VOICES / "manifest.json").read_text(encoding="utf-8"))
    kokoro = Kokoro(str(models / "kokoro-v1.0.int8.onnx"), str(models / "voices-v1.0.bin"))
    todo = [l for l in manifest["lines"] if not (VOICES / f"{l['id']}.mp3").exists()]
    print(f"{len(todo)} of {manifest['count']} lines to generate", flush=True)
    started = time.time()
    total_audio = 0.0
    for i, line in enumerate(todo, 1):
        voice = line["voice"]
        pitch = float(line.get("pitch", 1.0))
        speed = float(np.clip(line.get("speed", 1.0) / pitch, 0.5, 2.0))
        lang = "en-gb" if voice.startswith("b") else "en-us"
        samples, rate = kokoro.create(speakable(line["text"]), voice=voice, speed=speed, lang=lang)
        samples = shape(np.asarray(samples, dtype=np.float32), rate, pitch)
        sf.write(VOICES / f"{line['id']}.mp3", samples, rate, format="MP3")
        total_audio += len(samples) / rate
        if i % 25 == 0 or i == len(todo):
            print(f"{i}/{len(todo)}  {total_audio / 60:.1f} min of audio  {time.time() - started:.0f}s", flush=True)
    keep = {l["id"] for l in manifest["lines"]}
    stale = [p for p in VOICES.glob("*.mp3") if p.stem not in keep]
    for p in stale:
        p.unlink()
    if stale:
        print(f"removed {len(stale)} voice files no longer in the story")


if __name__ == "__main__":
    main()
