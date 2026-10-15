"""Re-records voice lines with Chatterbox until Whisper hears them say what the script says.
Usage: python tools/redo_voices.py id1,id2,... [--takes 6]
Needs the Chatterbox setup (see make_voices.py) plus: pip install faster-whisper
"""
import argparse
import json
import zlib
from difflib import SequenceMatcher
from pathlib import Path

import soundfile as sf
import torch
from chatterbox.tts import ChatterboxTTS
from faster_whisper import WhisperModel

from make_voices import REFS, ROOT, emotion, shape, speakable
from check_voices import words


def score(asr, path, text):
    segs, _ = asr.transcribe(str(path), language="en", beam_size=5)
    heard = " ".join(s.text.strip() for s in segs)
    want, got = words(text), words(heard)
    s = SequenceMatcher(None, want, got).ratio()
    junk = len(got) > len(want) + 1
    return s, heard, junk


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids")
    ap.add_argument("--takes", type=int, default=6)
    args = ap.parse_args()
    manifest = json.loads((ROOT / "voices" / "manifest.json").read_text(encoding="utf-8"))
    by_id = {l["id"]: l for l in manifest["lines"]}
    tts = ChatterboxTTS.from_pretrained(device="cpu")
    asr = WhisperModel("base.en", device="cpu", compute_type="int8")
    tmp = ROOT / "voices" / "_take.mp3"
    for lid in args.ids.split(","):
        line = by_id[lid]
        best = None
        for take in range(1, args.takes + 1):
            ex, cfg = emotion(line["who"], line["text"])
            if take > 2:
                ex = min(ex, 0.7)              # very high exaggeration is where the glitches come from
            torch.manual_seed(zlib.crc32(lid.encode()) + take * 7919)
            wav = tts.generate(speakable(line["text"]), audio_prompt_path=str(REFS / f"{line['who']}.wav"), exaggeration=ex, cfg_weight=cfg)
            sf.write(tmp, shape(wav.squeeze(0).numpy(), tts.sr), tts.sr, format="MP3")
            s, heard, junk = score(asr, tmp, line["text"])
            print(f"{lid} take {take}: {s:.2f}{' junk' if junk else ''} heard: {heard}", flush=True)
            if best is None or (s, not junk) > (best[0], not best[2]):
                best = (s, tmp.read_bytes(), junk)
            if s >= 0.9 and not junk:
                break
        (ROOT / "voices" / f"{lid}.mp3").write_bytes(best[1])
        print(f"{lid}: kept {best[0]:.2f} | {line['text']}", flush=True)
    tmp.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
