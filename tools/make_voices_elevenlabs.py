"""Records every voice line with ElevenLabs: brand-new voices designed from written descriptions (Voice Design),
then every line spoken with Eleven v4 (or another model).

The API key is read from a file in your home folder, ~/.elevenlabs_key (never from this repo, never printed).
Make it yourself in PowerShell:
  $k = Read-Host "Paste your ElevenLabs API key" -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($k)) | Set-Content -NoNewline "$env:USERPROFILE\\.elevenlabs_key"

Steps:
  python tools/make_voices_elevenlabs.py credits                    how many characters are left this month
  python tools/make_voices_elevenlabs.py design [who ...]           3 candidate voices each -> tools/refs/el/previews/
  python tools/make_voices_elevenlabs.py audition                   a page to listen to the candidates side by side
  python tools/make_voices_elevenlabs.py create [who=N ...]         keep candidate N (default 0) as that character's voice
  python tools/make_voices_elevenlabs.py generate [--ids a,b] [--who x] [--redo] [--model eleven_v4]
  python tools/make_voices_elevenlabs.py voices                     the same-person check (CPU Python with speechbrain)
Every take is checked like make_voices_higgs.py: Whisper has to hear the script's words, and the speaker check has to
agree it's the character's voice. Characters used are counted; it stops before going over --budget.
"""
import argparse
import base64
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
REFS = TOOLS / "refs" / "el"
PREVIEWS = REFS / "previews"
VOICES_FILE = TOOLS / "elevenlabs-voices.json"      # which ElevenLabs voice each character is (ids, not secrets)
PROGRESS = TOOLS / "voices-el.json"
KEY_FILE = Path.home() / ".elevenlabs_key"
API = "https://api.elevenlabs.io"
sys.path.insert(0, str(TOOLS))
from make_voices_higgs import SHOUT, PLEAD, words, word_score, shape, voice_ok  # noqa: E402
from make_driver_voice import delivery  # noqa: E402

# who each speaker is. New voices, described from scratch: none of them is anyone real.
VOICES = {
    "you": "A man in his mid-thirties, a night-shift city bus driver who lost his mother when he was four. A clear, warm, "
           "natural light baritone with crisp, close diction, gentle and earnest, a little tired. American, no accent.",
    "rhee": "A man in his sixties, a night bus dispatcher heard over a two-way radio. A cold, clipped, controlled baritone with "
            "an unsettling calm. Precise and commanding. When he's pushed, it cracks into rage. American.",
    "dana": "A woman in her forties, a night dispatcher on a two-way radio. A warm, alert, practical alto with a slight Midwestern "
            "accent. Worried but professional, speaks quickly.",
    "radio94": "A male radio news anchor in the early 1990s, in his forties. A smooth, measured, formal broadcast voice, grave and "
               "steady. American.",
    "teodor": "A very old man in his nineties, a retired city bus driver who came to America from Hungary sixty years ago. A soft, "
              "cracked, breathy voice with a faint Hungarian accent. Slow, gentle, full of regret and tenderness.",
    "teodor94": "A man in his late fifties, a city bus driver who came to America from Hungary. A firm, worried, working-class "
                "baritone with a faint Hungarian accent, speaking urgently over a crackling radio in a storm.",
    "mara": "A Black woman in her late twenties, a night-shift hospital nurse. A warm, tired, friendly mezzo voice with a dry sense "
            "of humor. Quick and natural. American.",
    "jun": "A young Korean-American man in his early twenties. A light, soft, slightly nasal tenor. Polite, nervous and "
           "earnest, speaks quickly. American.",
    "junmom": "A Korean-American woman in her forties who works two jobs. A soft-spoken, tired, gentle voice with a light Korean "
              "accent. Emotional and grateful.",
    "daniel": "A man in his mid-thirties, a gentle father, soaked through and cold. A soft, warm, low baritone, quiet and a little "
              "distant, like he's speaking from far away. American.",
    "lena": "A woman in her early thirties, a nurse and a young mother. A soft, warm, loving alto, gentle and tender, a little sad "
            "and far away. American.",
    "rosie": "A woman in her late thirties. A soft, hesitant, slightly husky voice, shy and apologetic, close to tears. American.",
    "voices": "A breathy, hushed, eerie whisper, sad and very quiet, like many people whispering at once in the dark.",
    "eddie": "A seventeen-year-old Mexican-American kid from East Los Angeles, a diner dishwasher. A friendly, youthful "
             "light baritone with a clear Mexican-American accent. Talks quickly and cheerfully, a little tired after a double shift.",
    "dorothy": "An elderly woman in her mid-seventies, a retired schoolteacher. A low, warm, gentle old woman's voice with the soft "
               "rasp of age. Clear, careful diction, kind and a little amused. American.",
    "frank": "A big man in his early fifties, a mail carrier. A deep, husky baritone with a working-class American accent. "
             "Easygoing and warm, a joker, slightly out of breath.",
    "carmen": "A young Latina woman in her late twenties, a tired young mother looking for her daughter. A soft, warm alto, "
              "worried and gentle, speaking quietly. American.",
    "marcus": "A young Black man in his mid-twenties. A smooth, warm baritone. Nervous and excited, like he's smiling while he "
              "talks, about to propose. American.",
}
# speakers ElevenLabs won't design a voice for (it doesn't make children's voices): they keep the voice they have
KEEP = {"ivy"}
# speakers who are the same person as another (the same voice)
SAME_AS = {"momcall": "junmom", "rhee94": "rhee", "harold": "rhee"}
# what they say in the candidates (100+ characters): their own lines, or these for the ones with few
PREVIEW_TEXT = {
    "voices": "You came back. He stopped. He stopped this time. We waited so long for someone to stop. "
              "We are still waiting at the stop with no name, in the rain.",
    "you": "I asked for it. I didn't tell them why. There's an old man in the back row. I didn't see him get on. "
           "My mother's name was Lena Marsh. I was four. Nobody ever told me how. They just said she wasn't coming home.",
    "teodor94": "Dispatch, this is Route 9. The river's coming over the road at Canal. I want to hold at Northgate till it "
                "passes. Harold, I've got kids on this bus.",
}


# how each character is played, beyond their voice: speed (Teodor talks faster than his design), and stability (lower
# is looser and more natural: Carmen sounds like she's talking, not reading)
SPEED = {"teodor": 1.5}
STABILITY = {"carmen": 0.3, "eddie": 0.3}
API_MAX_SPEED = 1.2


def wsola(x, rate, sr, frame_ms=46, tol_ms=18):
    """Speed speech up (rate > 1) without changing its pitch: overlap-add of short frames, each one picked where it
    lines up best with the last (WSOLA)."""
    n = int(sr * frame_ms / 1000) // 2 * 2
    hs = n // 2
    tol = int(sr * tol_ms / 1000)
    win = np.hanning(n)
    ha = hs * rate
    xp = np.concatenate([np.zeros(tol), x, np.zeros(2 * n + tol + int(ha))])
    y = np.zeros(int(len(x) / rate) + 3 * n)
    wsum = np.zeros_like(y)
    prev, k, out = tol, 0, 0
    while True:
        nominal = int(round(k * ha)) + tol
        if nominal + n + tol >= len(xp) - n or out + n >= len(y):
            break
        if k == 0:
            best = nominal
        else:
            target = xp[prev + hs: prev + hs + n]
            seg = xp[nominal - tol: nominal + tol + n]
            best = nominal - tol + int(np.argmax(np.correlate(seg, target, mode="valid")))
        y[out: out + n] += xp[best: best + n] * win
        wsum[out: out + n] += win
        prev, out, k = best, out + hs, k + 1
    return (y[: out + hs] / np.maximum(wsum[: out + hs], 1e-3)).astype(np.float32)


def key():
    if not KEY_FILE.exists():
        sys.exit(f"No API key: make {KEY_FILE} first (see the top of this file).")
    k = KEY_FILE.read_text(encoding="utf-8-sig").strip()
    if not k:
        sys.exit(f"{KEY_FILE} is empty.")
    return k


def call(method, path, body=None, query="", raw=False, tries=5):
    """One API call. Retries on busy (409/429) and server errors. Never prints the key."""
    url = f"{API}{path}{('?' + query) if query else ''}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    for attempt in range(tries):
        req = urllib.request.Request(url, data=data, method=method,
                                     headers={"xi-api-key": key(), "Content-Type": "application/json", "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                payload = r.read()
                return payload if raw else json.loads(payload.decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:400]
            if e.code in (409, 429, 500, 502, 503) and attempt < tries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            sys.exit(f"ElevenLabs said {e.code} for {method} {path}: {detail}")
        except urllib.error.URLError as e:
            if attempt < tries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            sys.exit(f"Couldn't reach ElevenLabs: {e}")


def load(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def save(path, data):
    path.write_text(json.dumps(data, indent=1), encoding="utf-8")


def manifest_lines():
    return json.loads((ROOT / "voices" / "manifest.json").read_text(encoding="utf-8"))["lines"]


def voice_of(who):
    return SAME_AS.get(who, who)


# ---------------------------------------------------------------- credits
def credits(_args=None):
    s = call("GET", "/v1/user/subscription")
    used, limit = s.get("character_count", 0), s.get("character_limit", 0)
    print(f"plan: {s.get('tier', '?')}   characters used {used:,} of {limit:,}   left {limit - used:,}", flush=True)
    return limit - used


# ---------------------------------------------------------------- step 1: design candidate voices
def preview_text(who):
    if who in PREVIEW_TEXT:
        return PREVIEW_TEXT[who]
    t = ""
    for line in manifest_lines():
        if voice_of(line["who"]) == who and len(t) < 260:
            t += (" " if t else "") + line["text"].replace("“", "").replace("”", "")
    return t[:900] if len(t) >= 100 else (t + " " + PREVIEW_TEXT.get("voices", ""))[:900]


def design(args):
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    state = load(VOICES_FILE, {"previews": {}, "voices": {}})
    for who in args.who_list or list(VOICES):
        if who in state["previews"] and not args.again:
            print(f"{who}: already has candidates (use --again to make new ones)", flush=True)
            continue
        try:
            res = call("POST", "/v1/text-to-voice/design", {
                "voice_description": VOICES[who], "model_id": "eleven_ttv_v3", "text": preview_text(who), "seed": 1994,
            }, query="output_format=mp3_44100_128")
        except SystemExit as e:
            print(f"{who}: not designed. {e}", flush=True)
            continue
        ids = []
        for i, p in enumerate(res.get("previews", [])):
            (PREVIEWS / f"{who}_{i}.mp3").write_bytes(base64.b64decode(p["audio_base_64"]))
            ids.append(p["generated_voice_id"])
        state["previews"][who] = ids
        save(VOICES_FILE, state)
        print(f"{who}: {len(ids)} candidates", flush=True)


def audition(_args):
    """A page with every candidate, to pick from (tools/refs/el/audition.html)."""
    state = load(VOICES_FILE, {"previews": {}, "voices": {}})
    rows = []
    for who, ids in state["previews"].items():
        clips = []
        for i in range(len(ids)):
            f = PREVIEWS / f"{who}_{i}.mp3"
            if f.exists():
                b64 = base64.b64encode(f.read_bytes()).decode("ascii")
                clips.append(f'<figure><figcaption>{who} {i}</figcaption><audio controls preload="none" src="data:audio/mpeg;base64,{b64}"></audio></figure>')
        rows.append(f"<section><h2>{who}</h2><p>{VOICES[who]}</p><div class=row>{''.join(clips)}</div></section>")
    out = REFS / "audition.html"
    out.write_text("<title>Voice Audition</title>" + "".join(rows), encoding="utf-8")
    print(f"wrote {out}", flush=True)


def create(args):
    """Keep one candidate per character as their voice: who=N picks design candidate N, who=rN remix candidate N
    (default 0). Changing a pick makes the new voice and deletes the old one."""
    state = load(VOICES_FILE, {"previews": {}, "voices": {}})
    state.setdefault("remix", {})
    picks = dict(a.split("=") for a in args.who_list if "=" in a)
    for who, ids in state["previews"].items():
        pick = picks.get(who, None)
        if who in state["voices"] and pick is None:
            continue
        pick = pick or "0"
        if str(state["voices"].get(who, {}).get("candidate")) == pick:
            continue
        remix = pick.startswith("r")
        n = int(pick[1:] if remix else pick)
        gid = state["remix"][who][n] if remix else ids[n]
        res = call("POST", "/v1/text-to-voice", {
            "voice_name": f"Last Stop - {who}", "voice_description": VOICES[who], "generated_voice_id": gid,
        })
        old = state["voices"].get(who, {}).get("voice_id")
        if old:
            call("DELETE", f"/v1/voices/{old}")
        state["voices"][who] = {"voice_id": res["voice_id"], "candidate": pick}
        save(VOICES_FILE, state)
        # the candidate is the reference the speaker check compares every line to
        data, rate = sf.read(str(PREVIEWS / f"{who}_{pick}.mp3"), dtype="float32", always_2d=True)
        sf.write(str(REFS / f"{who}.wav"), data.mean(axis=1), rate)
        print(f"{who}: candidate {pick} kept", flush=True)


def remix(args):
    """New candidates made from a character's current voice, changed as described: remix who "what to change"."""
    who, change = args.who_list[0], " ".join(args.who_list[1:])
    state = load(VOICES_FILE, {"previews": {}, "voices": {}})
    state.setdefault("remix", {})
    base = args.base or who                        # (--from jun: start from Jun's voice, not this character's own)
    if base not in state["voices"]:
        sys.exit(f"{base} has no voice yet: create it first")
    try:
        res = call("POST", f"/v1/text-to-voice/{state['voices'][base]['voice_id']}/remix", {
            "voice_description": change, "text": preview_text(who), "seed": 1994,
        }, query="output_format=mp3_44100_128")
    except SystemExit as e:
        print(f"{who}: not remixed. {e}", flush=True)
        return
    ids = []
    for i, p in enumerate(res.get("previews", [])):
        (PREVIEWS / f"{who}_r{i}.mp3").write_bytes(base64.b64decode(p["audio_base_64"]))
        ids.append(p["generated_voice_id"])
    state["remix"][who] = ids
    save(VOICES_FILE, state)
    print(f"{who}: {len(ids)} remixed candidates", flush=True)


# ---------------------------------------------------------------- step 2: record every line
# how each line is performed, written scene by scene from inside each character (tools/el-direction.txt)
DIRECTION = {}
for row in (TOOLS / "el-direction.txt").read_text(encoding="utf-8").splitlines():
    row = row.strip()
    if row and not row.startswith("#"):
        lid, _, tags = row.partition(" ")
        DIRECTION[lid] = tags.strip()


def acted(line):
    """The line with its performance in front (Eleven v4 audio tags), and the words made easy to say."""
    who, text = line["who"], line["text"]
    t = text.replace("“", "").replace("”", "").replace("—", "-")
    t = re.sub(r"\bSt\.", "Saint", t)
    t = re.sub(r"\b4B\b", "four B", t)
    t = re.sub(r"\bJun\b", "Joon", t)
    if t.strip() == "Rhee?":
        t = "Ree?"                       # (said on its own, it came out as "Three")
    # shouted word by word ("MAKE. UP. THE. TIME.") reads as one phrase, still shouted
    t = re.sub(r"\b([A-Z']+)\.(\s+[A-Z']+\.){2,}", lambda m: " ".join(w.strip(". ") for w in m.group(0).split()) + "!", t)
    if t and t[-1] not in ".!?,-":
        t += "..."                       # cut off mid-word: trails away
    if line["id"] in DIRECTION:
        tag = DIRECTION[line["id"]]
    elif who == "voices":
        tag = "[whispers]"
    elif SHOUT.search(text):
        tag = "[shouting]"
    elif PLEAD.search(text):
        tag = "[sad]"
    elif who == "you":
        tag = {"weary": "", "scared": "[nervous]", "terrified": "[terrified]"}[delivery(line)]
    elif who in ("daniel", "lena", "ivy"):
        tag = "[softly]"
    else:
        tag = ""
    return (tag + " " + t).strip()


def generate(args):
    from faster_whisper import WhisperModel
    state = load(VOICES_FILE, {"previews": {}, "voices": {}})
    asr = WhisperModel("base.en", device="cpu", compute_type="int8")
    lines = [l for l in manifest_lines() if l["who"] not in KEEP]
    if args.ids:
        lines = [l for l in lines if l["id"] in set(args.ids.split(","))]
    if args.who:
        lines = [l for l in lines if l["who"] in args.who.split(",")]
    progress = load(PROGRESS, {})
    if args.sample:
        by = {}
        for l in lines:
            by.setdefault(voice_of(l["who"]), []).append(l)
        lines = [x for ls in by.values() for x in ([ls[0], max(ls[1:], key=lambda l: len(l["text"]))] if len(ls) > 1 else ls)]
    if args.redo:
        lines = [l for l in lines if l["id"] in progress and not progress[l["id"]].get("ok", False)]
    elif not args.all:
        lines = [l for l in lines if l["id"] not in progress]
    missing = sorted({voice_of(l["who"]) for l in lines} - set(state["voices"]))
    if missing:
        sys.exit(f"No voice made yet for: {', '.join(missing)} (run design and create first)")
    spent = progress.get("_characters", 0) if isinstance(progress.get("_characters"), int) else 0
    need = sum(len(acted(l)) for l in lines) * args.takes
    left = credits()
    print(f"{len(lines)} lines to record with {args.model}: up to {need:,} characters", flush=True)
    if need > left:
        print("not enough characters left this month for every take; it will stop when they run out", flush=True)
    tmp = ROOT / "voices" / "_el_take.mp3"
    for n, line in enumerate(lines, 1):
        vid = state["voices"][voice_of(line["who"])]["voice_id"]
        rec = progress.get(line["id"], {})
        take0 = rec.get("takes", 0)
        best = None
        for take in range(take0, take0 + args.takes):
            text = acted(line) if take < 2 else acted(line).split("] ", 1)[-1]     # a line that keeps failing loses its cue
            if spent + len(text) > args.budget:
                save(PROGRESS, progress)
                sys.exit(f"stopping: the budget of {args.budget:,} characters is used up ({spent:,})")
            speed = SPEED.get(voice_of(line["who"]), 1.0)
            settings = {"stability": STABILITY.get(voice_of(line["who"]), 0.4), "similarity_boost": 0.8, "style": 0.35,
                        "use_speaker_boost": True, "speed": min(speed, API_MAX_SPEED)}
            audio = call("POST", f"/v1/text-to-speech/{vid}", {
                "text": text, "model_id": args.model, "seed": 1000 + take * 7919 + int(line["id"], 16) % 997,
                "voice_settings": settings,
            }, query="output_format=mp3_44100_128", raw=True)
            spent += len(text)
            progress["_characters"] = spent
            tmp.write_bytes(audio)
            data, rate = sf.read(str(tmp), dtype="float32", always_2d=True)
            mono = data.mean(axis=1)
            if speed > API_MAX_SPEED:
                mono = wsola(mono, speed / API_MAX_SPEED, rate)      # the rest of the speed-up, same pitch
            sf.write(str(tmp), shape(mono, rate), rate, format="MP3")
            segs, _ = asr.transcribe(str(tmp), language="en", beam_size=5)
            heard = " ".join(s.text.strip() for s in segs)
            score, extra = word_score(line["text"], heard)
            good = score >= 0.85 and extra <= 1
            print(f"  {line['id']} {line['who']} take {take}: words {score:.2f} | {heard[:70]}", flush=True)
            if best is None or (good, score) > (best[0], best[1]):
                best = (good, score, tmp.read_bytes(), heard, take, text)
            if good:
                break
        (ROOT / "voices" / f"{line['id']}.mp3").write_bytes(best[2])
        progress[line["id"]] = {"who": line["who"], "words": round(best[1], 3), "heard": best[3], "take": best[4],
                                "takes": take0 + args.takes, "ref": f"{voice_of(line['who'])}.wav", "ok_words": best[0],
                                "ok": False, "text": best[5]}
        save(PROGRESS, progress)
        if n % 10 == 0 or n == len(lines):
            print(f"{n}/{len(lines)} lines   {spent:,} characters so far", flush=True)
    tmp.unlink(missing_ok=True)


# acting that changes a voice a lot: the speaker match gets more room, but it still has to be the same person
BIG_FEELINGS = re.compile(r"\[(whispers|shouting|screaming|crying|terrified|breathless|laughs|sobbing|desperate|furious)", re.I)


def el_voice_ok(sim, seconds, text):
    """Is it the character? For acted lines the speaker match is what tells: crying, screaming and whispering move the
    pitch so far that pitch can't. A clip of a word or two is too short to judge, unless it's plainly someone else."""
    if seconds < 1.4:
        return sim >= 0.15
    return sim >= (0.3 if BIG_FEELINGS.search(text) else 0.45)


# ---------------------------------------------------------------- step 3: is it the same person? (CPU)
def voices(args):
    import librosa
    import torch
    from speechbrain.inference.speaker import EncoderClassifier
    from speechbrain.utils.fetching import LocalStrategy
    enc = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", savedir=str(TOOLS / "models" / "ecapa"),
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

    texts = {l["id"]: l["text"] for l in manifest_lines()}
    progress = load(PROGRESS, {})
    refs = {}
    todo = [k for k, v in progress.items() if k in texts and ("sim" not in v or args.all)]
    for lid in todo:
        rec = progress[lid]
        if rec["ref"] not in refs:
            w = load16k(REFS / rec["ref"])
            refs[rec["ref"]] = (embed(w), pitch(w))
        remb, rf0 = refs[rec["ref"]]
        w = load16k(ROOT / "voices" / f"{lid}.mp3")
        sim = float(embed(w) @ remb)
        f0 = pitch(w)
        ratio = f0 / rf0 if rf0 and f0 else 1.0
        seconds = len(w) / 16000
        ok_voice = el_voice_ok(sim, seconds, rec["text"])
        rec.update({"sim": round(sim, 3), "pitch": round(ratio, 2), "seconds": round(seconds, 2), "ok_voice": ok_voice,
                    "ok": bool(ok_voice and rec.get("ok_words"))})
        if not rec["ok"]:
            print(f"  redo {lid} {rec['who']}: voice {sim:.2f} pitch {ratio:.2f}x words {rec['words']:.2f}", flush=True)
    save(PROGRESS, progress)
    bad = [k for k, v in progress.items() if k in texts and not v.get("ok")]
    print(f"checked {len(todo)}; {len([k for k in progress if k in texts]) - len(bad)} good, {len(bad)} to record again", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["credits", "design", "audition", "create", "remix", "generate", "voices"])
    ap.add_argument("who_list", nargs="*")
    ap.add_argument("--again", action="store_true", help="design: new candidates even if there are some")
    ap.add_argument("--ids", default="")
    ap.add_argument("--who", default="")
    ap.add_argument("--takes", type=int, default=2)
    ap.add_argument("--redo", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--sample", action="store_true", help="generate: just two lines from every voice")
    ap.add_argument("--model", default="eleven_v4")
    ap.add_argument("--budget", type=int, default=60000, help="never send more than this many characters in all")
    ap.add_argument("--from", dest="base", default="", help="remix: start from this character's voice")
    args = ap.parse_args()
    {"credits": credits, "design": design, "audition": audition, "create": create, "remix": remix, "generate": generate,
     "voices": voices}[args.step](args)


if __name__ == "__main__":
    main()
