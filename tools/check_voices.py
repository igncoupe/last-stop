"""Listens to voice clips with Whisper and flags the ones that don't say what the script says
(a repeated word, a missing word, mumbling). Usage:
  python tools/check_voices.py [--who rhee] [--match "free"] [--all]
Prints each flagged clip with what Whisper heard. Needs: pip install faster-whisper
"""
import argparse
import json
import re
from difflib import SequenceMatcher
from pathlib import Path

from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
WORDS = re.compile(r"[a-z0-9']+")


def words(text):
    t = text.lower().replace("st.", "saint").replace("4b", "four b")
    return WORDS.findall(t)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--who", default="")
    ap.add_argument("--match", default="")
    ap.add_argument("--all", action="store_true", help="print every clip, not just suspicious ones")
    args = ap.parse_args()
    manifest = json.loads((ROOT / "voices" / "manifest.json").read_text(encoding="utf-8"))
    lines = [l for l in manifest["lines"] if (not args.who or l["who"] == args.who)
             and (not args.match or re.search(args.match, l["text"], re.I))]
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    bad = 0
    for l in lines:
        segs, _ = model.transcribe(str(ROOT / "voices" / f"{l['id']}.mp3"), language="en", beam_size=5)
        heard = " ".join(s.text.strip() for s in segs)
        want, got = words(l["text"]), words(heard)
        score = SequenceMatcher(None, want, got).ratio()
        repeated = [w for i, w in enumerate(got[1:], 1) if w == got[i - 1] and len(w) > 2 and
                    not any(want[j] == want[j - 1] == w for j in range(1, len(want)))]
        flag = score < 0.8 or repeated or len(got) > len(want) + 2
        if flag:
            bad += 1
        if flag or args.all:
            print(f"{'!!' if flag else 'ok'} {l['id']} {l['who']} {score:.2f}{' repeats ' + ','.join(repeated) if repeated else ''}")
            print(f"   script: {l['text']}")
            print(f"   heard:  {heard}")
    print(f"{len(lines)} clips checked, {bad} flagged")


if __name__ == "__main__":
    main()
