"""The driver's voice, with Qwen3-TTS (Apache 2.0).

The voice is designed from a written description (a new voice, not a copy of anyone's), once,
in three deliveries - weary, scared, terrified - and every one of the driver's lines is then
cloned from the matching delivery, so he always sounds like the same man.

Usage:
  python tools/make_driver_voice.py design            # writes tools/refs/driver_<delivery>.wav
  python tools/make_driver_voice.py lines [--worker 0 --workers 1] [--ids a,b] [--out voices]

Reads voices/manifest.json (made by tools/extract-lines.mjs); only lines spoken by "you".
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
from qwen_tts import Qwen3TTSModel

ROOT = Path(__file__).resolve().parent.parent
REFS = ROOT / "tools" / "refs"

# who he is: a Black New Yorker in his fifties, worn down by night shifts
VOICE = ("A Black man in his mid-fifties from the Bronx, New York. Deep, gravelly baritone, a little hoarse "
         "from years of night shifts. Thick New York accent with African American speech rhythm. Speaks low and close.")
DELIVERIES = {
    "weary": ("Tired and quiet, a little uneasy, like a man talking to himself at one in the morning.",
              "Mom took the last bus home every night. That's most of what I remember about her. "
              "Her keys in the door, at one in the morning."),
    "scared": ("Scared and trying to stay calm. His voice is tight and unsteady, he swallows between sentences.",
               "There's a poster on the shelter. It's the kid from last night. "
               "Somebody wrote something underneath it. Please. Anything."),
    "terrified": ("Terrified. His voice shakes and breaks, he's breathing hard and barely holding it together.",
                  "It hit the glass. It was on the glass, pressed flat, looking in at me. "
                  "It doesn't have a face. It doesn't have anything."),
}

TERRIFIED = re.compile(
    r"hit the glass|on the glass|it's back|hands|a face|pressed|hit someone|oh god|alone on the bus|nothing there|"
    r"something wet|breathing|can't feel|staring|not blinking|standing in the road|keeping up|\bash\b|knocking|"
    r"under the floor|faces under|struck match|getting on|cold coming|the shadow|smoke|doesn't have|shape of a man|"
    r"head turned|light went out|pedal is going|trying to get in|back of the bus|i'm not opening|grey|gray hands|"
    r"wrinkled|water is creeping|underwater|off the roof", re.I)
WEARY = re.compile(
    r"\bmom\b|mother|first night|asked for it|keys|i was four|lena marsh|the kid is me|made it home|keeping route 9|"
    r"music box|coffee|morning|i missed you|thirty-two years|nobody ever told me|barely slept|somewhere across town|"
    r"jun is here|for the first time|somebody has to stop|always stop|three weeks later|smiled|peacefully|"
    r"didn't tell them why|nobody else wanted|route 9\. depot to northgate", re.I)


def delivery(line):
    text = line["text"]
    if TERRIFIED.search(text):
        return "terrified"
    if line.get("kind") == "say" or WEARY.search(text):
        return "weary"
    return "scared"


def speakable(text: str) -> str:
    t = text.replace("“", "").replace("”", "").replace("—", ", ").replace("…", "...")
    t = re.sub(r"\bSt\.", "Saint", t)
    t = re.sub(r"\b4B\b", "four B", t)
    t = re.sub(r"\b[A-Z]{2,}\b", lambda m: m.group(0).capitalize(), t)
    t = t.strip()
    if t and t[-1] not in ".!?,":
        t += "..."
    return t


def shape(samples: np.ndarray, rate: int) -> np.ndarray:
    loud = np.where(np.abs(samples) > 0.015)[0]
    if len(loud):
        samples = samples[max(0, loud[0] - int(0.04 * rate)): min(len(samples), loud[-1] + int(0.2 * rate))]
    rms = np.sqrt(np.mean(samples ** 2)) or 1.0
    samples = samples * (0.1 / rms)
    peak = np.max(np.abs(samples)) or 1.0
    if peak > 0.95:
        samples = samples * (0.95 / peak)
    return samples.astype(np.float32)


def design():
    model = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", device_map="cpu", dtype=torch.float32)
    for name, (mood, text) in DELIVERIES.items():
        torch.manual_seed(1994)
        wavs, sr = model.generate_voice_design(text=text, language="English", instruct=f"{VOICE} {mood}")
        sf.write(REFS / f"driver_{name}.wav", wavs[0], sr)
        print(f"designed {name}: {len(wavs[0]) / sr:.1f}s", flush=True)


def lines(args):
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / "voices" / "manifest.json").read_text(encoding="utf-8"))
    todo = [l for l in manifest["lines"] if l["who"] == "you"]
    if args.ids:
        wanted = set(args.ids.split(","))
        todo = [l for l in todo if l["id"] in wanted]
    todo = [l for i, l in enumerate(todo) if i % args.workers == args.worker]
    todo.sort(key=lambda l: -len(l["text"]))
    print(f"worker {args.worker}: {len(todo)} lines", flush=True)
    model = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-Base", device_map="cpu", dtype=torch.float32)
    prompts = {name: model.create_voice_clone_prompt(ref_audio=str(REFS / f"driver_{name}.wav"), ref_text=text)
               for name, (_, text) in DELIVERIES.items()}
    started = time.time()
    for n, line in enumerate(todo, 1):
        torch.manual_seed(zlib.crc32(line["id"].encode()))
        wavs, sr = model.generate_voice_clone(text=speakable(line["text"]), language="English",
                                              voice_clone_prompt=prompts[delivery(line)])
        sf.write(out / f"{line['id']}.mp3", shape(wavs[0], sr), sr, format="MP3")
        print(f"worker {args.worker}: {n}/{len(todo)} [{delivery(line)}] {(time.time() - started) / 60:.1f} min", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["design", "lines"])
    ap.add_argument("--out", default=str(ROOT / "voices"))
    ap.add_argument("--worker", type=int, default=0)
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--threads", type=int, default=0)
    ap.add_argument("--ids", default="")
    args = ap.parse_args()
    if args.threads:
        torch.set_num_threads(args.threads)
    design() if args.step == "design" else lines(args)


if __name__ == "__main__":
    main()
