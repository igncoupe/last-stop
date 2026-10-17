"""Records every voice line with Higgs TTS 3 (Boson AI's Higgs Audio, free for creators with credit).

Each character keeps their voice: Higgs clones it from tools/refs/<who>.wav (the driver from
tools/refs/driver_<weary|scared|terrified>.wav, picked per line). Each line gets a light, natural
emotion tag at the start (fear, sadness, shouting...), never stacked effects.

Every take is checked, and a line is recorded again (new seed) until it passes:
  words  - Whisper has to hear what the script says
  voice  - it has to sound like the same person as the reference (speaker match + pitch), so a line
           can never come out in somebody else's voice
The voice check needs SpeechBrain, which runs in a separate (CPU) Python, so it's a second step:

  python tools/make_voices_higgs.py generate [--ids a,b] [--who rhee]   (GPU Python with Higgs)
  python tools/make_voices_higgs.py voices                              (CPU Python with speechbrain)
  python tools/make_voices_higgs.py generate --redo                     (re-records what failed)

Needs: the Higgs v3 weights (HIGGS_MODEL, default models/higgs3) and the native inference module from
https://github.com/Saganaki22/Higgs_v3-TTS-ComfyUI (HIGGS_NATIVE, the folder with native.py).
Progress goes to voices-higgs.json next to this script, so a run can stop and pick up again.
"""
import argparse
import json
import os
import re
import sys
import time
import types
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
REFS = ROOT / "tools" / "refs"
PROGRESS = Path(__file__).resolve().parent / "voices-higgs.json"
CHAR_REF_TEXT = ("I used to take the last bus home every night. The city gets so quiet at that hour. "
                 "You can hear the rain on the roof, and you start thinking about the people you lost, "
                 "and whether they ever really made it home.")
sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_driver_voice import DELIVERIES, delivery  # noqa: E402

# how each character sounds when nothing in the line says otherwise (light: one tag at most)
CHARACTER = {
    "teodor": "<|emotion:sadness|>", "teodor94": "<|emotion:fear|>", "rhee94": "<|emotion:determination|>",
    "lena": "<|emotion:affection|>", "daniel": "<|emotion:sadness|>", "momcall": "<|emotion:helplessness|>",
    "rosie": "<|emotion:sadness|>", "harold": "<|emotion:shame|>", "voices": "<|style:whispering|>",
}
SHOUT = re.compile(r"\b(?!I\b|OK\b|GPS\b|ID\b)[A-Z]{2,}\b|!")
PLEAD = re.compile(r"oh god|no, no|please|i'm sorry|i missed you|that's my kid|not you too|mom\b", re.I)
NUM = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
       "10": "ten", "11": "eleven", "12": "twelve", "14": "fourteen", "15": "fifteen", "19": "nineteen", "20": "twenty", "30": "thirty", "31": "thirty one"}
WORDS = re.compile(r"[a-z0-9']+")


def ref_for(line):
    if line["who"] == "you":
        tier = delivery(line)
        return REFS / f"driver_{tier}.wav", DELIVERIES[tier][1]
    return REFS / f"{line['who']}.wav", CHAR_REF_TEXT


def speakable(text):
    t = text.replace("“", "").replace("”", "").replace("…", "...")
    # shouted word-by-word ("MAKE. UP. THE. TIME.") reads as one punchy phrase, not four stops
    t = re.sub(r"\b([A-Z']+)\.(\s+[A-Z']+\.){2,}", lambda m: " ".join(w.strip(". ") for w in m.group(0).split()) + "!", t)
    t = re.sub(r"\bSt\.", "Saint", t)
    t = re.sub(r"\bJun\b", "Joon", t)
    t = re.sub(r"\b4B\b", "four B", t)
    t = re.sub(r"\b[A-Z][A-Z']*[A-Z]\b", lambda m: m.group(0).lower() if m.group(0) not in ("GPS", "OK", "ID") else m.group(0), t)
    t = re.sub(r"(^|[.!?]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), t)       # sentences start with a capital
    t = t.replace("—", "-").strip()
    if t and t[-1] not in ".!?,-":
        t += "..."
    return t


def tagged(line):
    """The line, with one or two sentence-level tags in front."""
    who, text = line["who"], line["text"]
    tags = []
    if SHOUT.search(text):
        tags.append("<|emotion:anger|>" if who in ("rhee", "rhee94") else "<|emotion:fear|>")
        tags.append("<|style:shouting|>")
    elif PLEAD.search(text):
        tags.append("<|emotion:sadness|>")
    elif who == "you":
        tier = delivery(line)
        tags.append({"weary": "", "scared": "<|emotion:fear|>", "terrified": "<|emotion:fear|><|prosody:expressive_high|>"}[tier])
    else:
        tags.append(CHARACTER.get(who, ""))
    return "".join(tags) + speakable(text)


def words(text):
    t = text.lower().replace("st.", "saint").replace("4b", "four b").replace("jun", "joon").replace("june", "joon")
    out = []
    for w in WORDS.findall(t):
        out.extend(NUM.get(w, w).split())
    return out


def word_score(script, heard):
    want = words(script)
    got = [("joon" if w in ("june", "jun", "john", "joon") else w) for w in words(heard)]
    want = [("joon" if w in ("june", "jun", "john") else w) for w in want]
    s = SequenceMatcher(None, want, got).ratio()
    extra = max(0, len(got) - len(want))
    return s, extra


def load_progress():
    return json.loads(PROGRESS.read_text(encoding="utf-8")) if PROGRESS.exists() else {}


def save_progress(p):
    PROGRESS.write_text(json.dumps(p, indent=1), encoding="utf-8")


def shape(samples, rate):
    loud = np.where(np.abs(samples) > 0.015)[0]
    if len(loud):
        samples = samples[max(0, loud[0] - int(0.04 * rate)): min(len(samples), loud[-1] + int(0.15 * rate))]
    rms = np.sqrt(np.mean(samples ** 2)) or 1.0
    samples = samples * (0.1 / rms)
    peak = np.max(np.abs(samples)) or 1.0
    if peak > 0.95:
        samples = samples * (0.95 / peak)
    return samples.astype(np.float32)


# ---------------------------------------------------------------- step 1: record (GPU)
def generate(args):
    import torch
    from faster_whisper import WhisperModel
    sys.path.insert(0, os.environ.get("HIGGS_NATIVE", "higgs3-comfy"))
    import native

    def load_audio(path):
        data, rate = sf.read(str(path), dtype="float32", always_2d=True)
        return torch.from_numpy(data.mean(axis=1)).contiguous(), int(rate)
    native.load_audio_path = load_audio

    model_dir = Path(os.environ.get("HIGGS_MODEL", "models/higgs3"))
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dtype = torch.bfloat16 if device.type == "cuda" else torch.float32
    model = native.build_native_model(native.read_config(model_dir), dtype, "sdpa")
    native.load_native_weights(model, model_dir, device, dtype)
    bundle = types.SimpleNamespace(model=model, codec=native.HiggsAudioCodec.from_pretrained(model_dir, device=device, dtype=torch.float32),
                                   tokenizer=native.load_tokenizer(model_dir), attention="sdpa")
    asr = WhisperModel("base.en", device="cpu", compute_type="int8")

    manifest = json.loads((ROOT / "voices" / "manifest.json").read_text(encoding="utf-8"))
    lines = manifest["lines"]
    if args.ids:
        wanted = set(args.ids.split(","))
        lines = [l for l in lines if l["id"] in wanted]
    if args.who:
        lines = [l for l in lines if l["who"] in args.who.split(",")]
    progress = load_progress()
    if args.redo:
        lines = [l for l in lines if l["id"] in progress and not progress[l["id"]].get("ok", False)]
    elif not args.all:
        lines = [l for l in lines if l["id"] not in progress]
    print(f"{len(lines)} lines to record on {device}", flush=True)
    tmp = ROOT / "voices" / "_higgs_take.mp3"
    started = time.time()
    for n, line in enumerate(lines, 1):
        ref, ref_text = ref_for(line)
        text = tagged(line)
        rec = progress.get(line["id"], {})
        take0 = rec.get("takes", 0)
        best = None
        for take in range(take0, take0 + args.takes):
            # a line that keeps failing gets simpler: no tags after two takes, calmer sampling after four
            text_now = text if take < 2 else speakable(line["text"])
            temp = 0.75 if take < 4 else 0.6
            out = native.generate_higgs_audio(
                bundle, text=text_now, reference_audio=None, reference_audio_path=str(ref), reference_text=ref_text,
                max_new_tokens=1024, temperature=temp, top_p=0.95, top_k=50, seed=1000 + take * 7919 + int(line["id"], 16) % 997,
                trim_reference_audio=True, silence_threshold_db=-42.0, max_reference_seconds=20.0)
            wav = shape(out["waveform"].view(-1).numpy(), out["sample_rate"])
            sf.write(tmp, wav, out["sample_rate"], format="MP3")
            segs, _ = asr.transcribe(str(tmp), language="en", beam_size=5)
            heard = " ".join(s.text.strip() for s in segs)
            score, extra = word_score(line["text"], heard)
            good = score >= 0.85 and extra <= 1
            print(f"  {line['id']} {line['who']} take {take}: words {score:.2f}{' +' + str(extra) if extra else ''} | {heard[:70]}", flush=True)
            if best is None or (good, score) > (best[0], best[1]):
                best = (good, score, tmp.read_bytes(), heard, take, text_now)
            if good:
                break
        (ROOT / "voices" / f"{line['id']}.mp3").write_bytes(best[2])
        progress[line["id"]] = {"who": line["who"], "words": round(best[1], 3), "heard": best[3], "take": best[4],
                                "takes": take0 + args.takes, "ref": ref.name, "ok_words": best[0], "ok": False, "text": best[5]}
        save_progress(progress)
        if n % 10 == 0 or n == len(lines):
            print(f"{n}/{len(lines)} lines  {(time.time() - started) / 60:.1f} min", flush=True)
    tmp.unlink(missing_ok=True)


# ---------------------------------------------------------------- step 2: is it the same person? (CPU)
def voices(args):
    import librosa
    import torch
    from speechbrain.inference.speaker import EncoderClassifier
    from speechbrain.utils.fetching import LocalStrategy
    enc = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", savedir=str(Path("models") / "ecapa"),
                                         run_opts={"device": "cpu"}, local_strategy=LocalStrategy.COPY)

    def load16k(path):
        data, rate = sf.read(str(path), dtype="float32", always_2d=True)
        w = data.mean(axis=1)
        return librosa.resample(w, orig_sr=rate, target_sr=16000) if rate != 16000 else w

    def embed(w):
        with torch.no_grad():
            return torch.nn.functional.normalize(enc.encode_batch(torch.from_numpy(w).unsqueeze(0)).squeeze(), dim=0)

    def pitch(w):
        f0, voiced, _ = librosa.pyin(w, fmin=60, fmax=500, sr=16000, frame_length=1024)
        f0 = f0[voiced & ~np.isnan(f0)]
        return float(np.median(f0)) if len(f0) else 0.0

    refs = {}
    progress = load_progress()
    todo = [k for k, v in progress.items() if "sim" not in v or args.all]
    for n, lid in enumerate(todo, 1):
        rec = progress[lid]
        if rec["ref"] not in refs:
            w = load16k(REFS / rec["ref"])
            refs[rec["ref"]] = (embed(w), pitch(w))
        remb, rf0 = refs[rec["ref"]]
        w = load16k(ROOT / "voices" / f"{lid}.mp3")
        sim = float(embed(w) @ remb)
        f0 = pitch(w)
        ratio = f0 / rf0 if rf0 and f0 else 1.0
        loud = "<|style:shouting|>" in rec["text"]
        whisper = "<|style:whispering|>" in rec["text"]
        # the same person: a close speaker match, and not suddenly a much higher (or lower) voice.
        # Shouting and whispering change a voice, so they get a little more room.
        ok_voice = sim >= (0.42 if (loud or whisper) else 0.5) and (whisper or 0.6 <= ratio <= (2.0 if loud else 1.6))
        rec.update({"sim": round(sim, 3), "pitch": round(ratio, 2), "ok_voice": ok_voice, "ok": bool(ok_voice and rec.get("ok_words"))})
        if not rec["ok"]:
            print(f"  redo {lid} {rec['who']}: voice {sim:.2f} pitch {ratio:.2f}x words {rec['words']:.2f}", flush=True)
        if n % 25 == 0:
            save_progress(progress)
    save_progress(progress)
    bad = [k for k, v in progress.items() if not v.get("ok")]
    print(f"checked {len(todo)}; {len(progress) - len(bad)} good, {len(bad)} to record again", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["generate", "voices"])
    ap.add_argument("--ids", default="")
    ap.add_argument("--who", default="")
    ap.add_argument("--takes", type=int, default=2, help="takes per line per run (more if the words are wrong)")
    ap.add_argument("--redo", action="store_true", help="record again the lines that failed a check")
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    (generate if args.step == "generate" else voices)(args)


if __name__ == "__main__":
    main()
