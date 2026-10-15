"""Makes a ~10 second reference recording for each character with Kokoro.
Chatterbox (tools/make_voices.py) copies the voice from these.

Usage: python tools/make_refs.py <folder with kokoro-v1.0.onnx or .int8.onnx + voices-v1.0.bin>
Writes tools/refs/<character>.wav
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
REFS = ROOT / "tools" / "refs"
TEXT = ("I used to take the last bus home every night. The city gets so quiet at that hour. "
        "You can hear the rain on the roof, and you start thinking about the people you lost, "
        "and whether they ever really made it home.")


def cast():
    """Reads voice, speed and pitch for every character out of js/story/cast.js."""
    src = (ROOT / "js" / "story" / "cast.js").read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r"^\s{2}(\w+):\s*\{(.*)\},?\s*$", src, re.M):
        body = m.group(2)
        voice = re.search(r'voice:\s*"(\w+)"', body)
        if not voice:
            continue
        num = lambda k, d: float(re.search(rf"{k}:\s*([\d.]+)", body).group(1)) if re.search(rf"{k}:\s*([\d.]+)", body) else d
        out[m.group(1)] = {"voice": voice.group(1), "speed": num("speed", 1.0), "pitch": num("pitch", 1.0)}
    return out


def main():
    models = Path(sys.argv[1])
    onnx = models / "kokoro-v1.0.onnx"
    if not onnx.exists():
        onnx = models / "kokoro-v1.0.int8.onnx"
    k = Kokoro(str(onnx), str(models / "voices-v1.0.bin"))
    REFS.mkdir(parents=True, exist_ok=True)
    for who, c in cast().items():
        lang = "en-gb" if c["voice"].startswith("b") else "en-us"
        samples, rate = k.create(TEXT, voice=c["voice"], speed=c["speed"], lang=lang)
        samples = np.asarray(samples, dtype=np.float32)
        if abs(c["pitch"] - 1) > 1e-3:   # bake the pitch into the reference
            samples = np.interp(np.arange(0, len(samples) - 1, c["pitch"]), np.arange(len(samples)), samples).astype(np.float32)
        sf.write(REFS / f"{who}.wav", samples, rate)
        print(who, c["voice"], f"{len(samples) / rate:.1f}s")


if __name__ == "__main__":
    main()
