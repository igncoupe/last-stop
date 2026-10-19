"""Cuts the Steam trailer from footage captured with capture.js/shots.js and sound recorded with sounds.js.

  python tools/trailer/make_trailer.py RAW_DIR OUT.mp4 [--preview SECONDS_FROM SECONDS_TO] [--frames DIR]

RAW_DIR holds one folder of PNG frames per shot (960x540, 60 fps), audio/*.wav (48 kHz) and text/*.png (1920x1080
overlays). Out comes 1920x1080, 60 fps, H.264 (High, BT.709) + AAC 48 kHz stereo, faststart: what Steam asks for.
No jumpscares in it: the scares are the game's to show you.
"""
import argparse
import math
from pathlib import Path

import av
import numpy as np
import soundfile as sf
from PIL import Image

W, H = 1920, 1080
SR = 48000

# ---------------------------------------------------------------- the cut
FPS = 60
END = 122.5

# shots: (start, end, what, options). what: a shot's folder of frames, or "black". Options: src (first frame),
# fin/fout (fade from/to whatever is under it, in seconds), text/tin/tout (a card's words, and their fades).
# Shots that overlap are mixed: the later one fades in over the earlier (a crossfade); a gap is black.
CUT = [
    (1.6, 6.0, "s_storm_ext", {"src": 0, "fin": 1.2, "fout": 0.7}),
    (6.2, 8.8, "black", {"text": "card_route9", "tin": 0.5, "tout": 0.6}),
    (9.0, 14.3, "n1_oldman", {"src": 0, "fin": 0.7}),
    (13.9, 18.9, "n_display", {"src": 0, "fin": 0.4, "fout": 0.6}),
    (19.3, 22.0, "black", {"text": "card_stop", "tin": 0.5, "tout": 0.6}),
    (22.2, 27.7, "n2_shelter_close", {"src": 0, "fin": 0.9}),
    (27.2, 32.2, "n2_lena_door", {"src": 0, "fin": 0.5, "fout": 0.6}),
    (32.8, 38.2, "s_fog", {"src": 150, "fin": 0.6}),
    (37.8, 43.9, "s_honk2", {"src": 760, "fin": 0.5}),
    (43.6, 48.2, "s_honk2_close", {"src": 1112, "fin": 0.3, "fout": 0.9}),
    (48.8, 52.9, "n3_teodor_bed", {"src": 0, "fin": 0.8}),
    (52.4, 58.6, "n3_window_fog", {"src": 300, "fin": 0.5, "fout": 0.6}),
    (59.0, 62.4, "s_board", {"src": 20, "fin": 0.6}),
    (62.0, 66.5, "s_board", {"src": 440, "fin": 0.4}),
    (66.1, 75.4, "s_mom_behind", {"src": 20, "fin": 0.5, "fout": 0.5}),
    (75.6, 82.6, "s_bridge_ext", {"src": 300, "fin": 0.3, "lift": 1.35}),
    (82.3, 88.3, "s_plunge", {"src": 30, "fin": 0.3, "lift": 1.5}),
    (88.0, 92.5, "s_flood_in", {"src": 0, "fin": 0.4}),
    (92.2, 95.7, "s_doors", {"src": 0, "fin": 0.3}),
    (95.4, 104.88, "s_turn", {"src": 20, "fin": 0.4}),
    (107.6, 111.6, "n5_fourteen", {"src": 0, "fin": 1.2, "fout": 0.9}),
    (111.8, 117.8, "black", {"text": "title", "tin": 1.2}),
]

# words on screen: (from, to, png in text/). Subtitles start when the voice does and stay a beat after.
OVERLAYS = [
    (2.30, 7.90, "s_rhee_evening_full"),
    (9.30, 14.20, "s_rhee_rules"),
    (14.40, 20.70, "s_you_display"),
    (22.60, 27.70, "s_mara_ride"),
    (28.10, 31.80, "s_lena_met"),
    (32.20, 33.70, "s_voices_came"),
    (39.22, 42.30, "s_you_fu"),
    (43.90, 48.20, "s_you_nobody"),
    (50.00, 51.50, "s_old_late"),
    (53.00, 58.60, "s_old_radio"),
    (59.80, 65.10, "s_you_doors"),
    (71.20, 72.50, "s_lena_grew"),
    (73.50, 74.60, "s_you_mom"),
    (75.90, 79.00, "s_rhee_eleven"),
    (79.50, 82.30, "s_rhee_make"),
    (82.50, 84.80, "s_rhee_faster"),
    (88.40, 93.10, "s_you_coming3"),
    (93.40, 96.70, "s_you_comeon2"),
    (102.70, 104.60, "s_voices_stay"),
    (106.40, 107.90, "s_lena_hi"),
    (108.80, 111.40, "card_stopfor"),
    (114.00, 117.80, "wishlist"),
    (118.20, 121.70, "s_rhee_tomorrow"),
]
FADE_TEXT = {"card_stopfor": 0.5, "wishlist": 0.6}

# sound: (at, wav in audio/, gain dB, options). A voice line's `at` is when the voice starts (silence before it is
# trimmed). Options: cut=(from, to) seconds into the file (always in the quiet between words), fin/fout fades,
# loop=seconds to fill (crossfaded), bus = vo | music | amb | sfx
V = {"bus": "vo"}
SOUND = [
    # the street, the storm, the first night
    (0.30, "amb_rain", -3, {"loop": 21.0, "fin": 2.0, "fout": 1.5, "bus": "amb"}),
    (1.40, "sfx_static", -9, {"cut": (0.1, 1.2)}),
    (2.20, "amb_rain_engine", -4, {"cut": (2.0, 8.0), "fin": 1.5, "fout": 1.5, "bus": "amb"}),
    (2.30, "vo_018b35f7", 0, V),
    (6.20, "sfx_bang", -10, {}),
    (6.20, "mood_uneasy", -3, {"loop": 15.5, "fin": 1.5, "fout": 2.5, "bus": "music"}),
    (9.30, "vo_2383af51", 0, {"cut": (3.1, 8.19), "bus": "vo"}),
    (13.95, "sfx_static", -12, {"cut": (0.1, 0.7)}),
    (14.40, "vo_3e6533b0", 0, V),
    (19.30, "sfx_bang", -10, {}),
    # the shelter, Mom at the doors, the fog
    (20.50, "mood_dread", -2, {"loop": 55.2, "fin": 2.5, "fout": 0.6, "bus": "music"}),
    (22.00, "amb_rain", -7, {"loop": 16.0, "fin": 0.8, "fout": 0.6, "bus": "amb"}),
    (22.60, "vo_97309180", 0, V),
    (28.10, "vo_07c2370f", 0, V),
    (29.50, "sfx_whisper", -6, {}),
    (32.20, "vo_6fd90922", 0, V),
    (33.30, "sfx_squeak", -5, {}),
    (35.50, "sfx_squeak", -9, {"cut": (0.1, 2.5)}),
    # the car
    (37.80, "amb_rain_engine", -6, {"cut": (2.0, 8.5), "fin": 0.4, "fout": 0.4, "bus": "amb"}),
    (37.95, "sfx_horn", -5, {"cut": (0.1, 1.5)}),
    (39.22, "vo_83a0fb23", 0, V),
    (43.60, "sfx_rise", -7, {}),
    (43.90, "vo_e9e244bf", 0, V),
    # St. Agnes, 4B
    (48.90, "sfx_beeps", -11, {"cut": (0.1, 4.0)}),
    (50.00, "vo_c8b7b688", 0, V),
    (52.60, "sfx_squeak", -8, {"cut": (0.1, 3.0)}),
    (53.00, "vo_e19a942e", 0, V),
    (55.30, "sfx_squeak", -10, {"cut": (0.1, 2.0)}),
    # they get on; Mom
    (59.00, "sfx_door", -9, {}),
    (59.80, "vo_0cfa0f8e", 0, V),
    (66.00, "amb_rain", -13, {"loop": 9.4, "fin": 1.0, "fout": 0.5, "bus": "amb"}),
    (66.20, "sfx_breath", -8, {}),
    (67.40, "sfx_heartbeat", -11, {}),
    (66.80, "sfx_drip", -6, {}),
    (68.60, "sfx_drip", -8, {}),
    (71.20, "vo_4518468c", 0, V),
    (73.50, "vo_9298e7e3", 0, V),
    (73.70, "sfx_rise", -5, {"cut": (0.0, 3.0)}),
    # the bridge
    (75.60, "mood_terror", -3, {"loop": 29.3, "fin": 0.6, "fout": 0.05, "bus": "music"}),
    (75.60, "amb_rain", -6, {"loop": 7.0, "fin": 0.2, "fout": 0.6, "bus": "amb"}),
    (75.90, "vo_ce82045a", 0, V),
    (79.50, "sfx_sting", -2, {}),
    (79.50, "sfx_slam", -4, {}),
    (79.50, "vo_e5be74f8", 2, V),
    (82.30, "sfx_ignition", -6, {}),
    (82.50, "vo_8937e20f", 0, {"cut": (0.0, 2.2), "bus": "vo"}),
    (83.75, "sfx_scrape", -2, {}),
    (83.75, "sfx_bang", -5, {}),
    (84.30, "sfx_plunge", 0, {}),
    (84.30, "sfx_slam", -5, {}),
    (84.60, "sfx_gush", -4, {}),
    (85.10, "sfx_splash", -7, {}),
    # under
    (88.00, "amb_underwater", 0, {"loop": 16.9, "fin": 0.4, "fout": 0.05, "bus": "amb"}),
    (88.00, "sfx_gush", -3, {}),
    (88.40, "vo_c8838305", 0, {"cut": (0.0, 5.2), "bus": "vo"}),
    (92.70, "sfx_bang", -2, {}),
    (93.00, "sfx_heartbeat", -4, {}),
    (93.30, "sfx_bang", -2, {}),
    (93.40, "vo_2b0a3f5c", 0, {"cut": (0.0, 3.73), "bus": "vo"}),
    (93.90, "sfx_bang", -2, {}),
    (95.30, "sfx_knock", -4, {}),
    (97.50, "sfx_sting", -6, {}),
    (97.50, "sfx_moan", 0, {"cut": (1.0, 6.5)}),
    (101.15, "sfx_lightsout", 0, {}),
    (101.15, "sfx_bubbles", -4, {}),
    (102.48, "sfx_click", -4, {}),
    (102.70, "vo_4f1ccf4b", 2, V),
    (104.55, "sfx_lightsout", 0, {}),
    # after
    (106.40, "vo_6d286338", 0, V),
    (107.40, "mood_grief", 1, {"loop": 9.5, "fin": 1.8, "fout": 2.5, "bus": "music"}),
    (107.40, "amb_rain", -8, {"loop": 12.0, "fin": 1.5, "fout": 1.0, "bus": "amb"}),
    (111.80, "sfx_thunder", 2, {}),
    (111.80, "sfx_slam", -3, {}),
    (118.20, "vo_755b438a", 0, V),
    (121.90, "sfx_static", -8, {"cut": (0.1, 0.35)}),
]
# everything goes quiet, all at once: (from, to)
SILENCE = [(104.88, 106.0)]


# ---------------------------------------------------------------- picture
def vignette():
    y, x = np.mgrid[0:H // 2, 0:W // 2].astype(np.float32)
    nx, ny = (x - W / 4) / (W / 4), (y - H / 4) / (H / 4)
    r = np.sqrt(nx * nx * 0.9 + ny * ny * 1.1)
    return np.clip(1.0 - 0.42 * np.clip(r - 0.35, 0, None) ** 1.6, 0.45, 1.0)[..., None].astype(np.float32)


VIG = vignette()
RNG = np.random.default_rng(1994)


def grade(img, lift=1.0):
    """The look: a little darker, crushed shadows with a cold cast, slightly drained color. lift brightens a shot that's
    too dark to read first (night exteriors)."""
    x = np.clip(img.astype(np.float32) / 255.0 * lift, 0, 1)
    lum = (x[..., :1] * 0.2126 + x[..., 1:2] * 0.7152 + x[..., 2:] * 0.0722)
    x = lum + (x - lum) * 0.82                                   # less saturated
    x = np.clip(x, 0, 1) ** 1.12                                 # darker mids
    x = (x - 0.03) / 0.97                                        # crush the floor a touch
    shadow = np.clip(1 - lum * 2.2, 0, 1)
    x = x + shadow * np.array([-0.006, 0.004, 0.012], np.float32)  # cold shadows
    x = x * VIG
    return np.clip(x, 0, 1)


def up(x):
    return np.repeat(np.repeat(x, 2, axis=0), 2, axis=1)          # each game pixel to 2x2, sharp


# grain the size of a game pixel (2x2), so it reads as part of the picture and still compresses
GRAIN = [up(RNG.normal(0, 1, (H // 2, W // 2, 1)).astype(np.float32)) for _ in range(6)]


class Frames:
    def __init__(self, raw):
        self.raw = raw
        self.cache = {}
        self.text = {}

    def shot(self, name, i):
        f = self.raw / name / f"{i:04d}.png"
        if not f.exists():                                       # past the end of a shot: hold its last frame
            frames = sorted((self.raw / name).glob("*.png"))
            f = frames[-1] if i > int(frames[-1].stem) else frames[0]
        return np.asarray(Image.open(f).convert("RGB"))

    def overlay(self, name):
        if name not in self.text:
            a = np.asarray(Image.open(self.raw / "text" / f"{name}.png").convert("RGBA")).astype(np.float32) / 255.0
            ys, xs = np.where(a[..., 3] > 0.002)
            box = (ys.min(), ys.max() + 1, xs.min(), xs.max() + 1) if len(ys) else None
            self.text[name] = (a, box)
        return self.text[name]


def put(frame, ov, alpha=1.0):
    a, box = ov
    if box is None or alpha <= 0:
        return
    y0, y1, x0, x1 = box
    o = a[y0:y1, x0:x1]
    k = o[..., 3:] * alpha
    frame[y0:y1, x0:x1] = frame[y0:y1, x0:x1] * (1 - k) + o[..., :3] * k


def fade_k(t, start, length, fin, fout):
    k = 1.0
    if fin:
        k = min(k, (t - start) / fin)
    if fout:
        k = min(k, (start + length - t) / fout)
    return max(0.0, min(1.0, k))


def picture(t, fr):
    frame = np.zeros((H, W, 3), np.float32)
    for start, end, what, o in CUT:
        if not start <= t < end:
            continue
        k = fade_k(t, start, end - start, o.get("fin", 0), o.get("fout", 0))
        if what == "black":
            layer = np.zeros_like(frame)
        else:
            i = o.get("src", 0) + int((t - start) * FPS + 0.5)
            layer = up(grade(fr.shot(what, i), o.get("lift", 1.0)))
        frame = frame * (1 - k) + layer * k
        if o.get("text"):
            put(frame, fr.overlay(o["text"]), fade_k(t, start, end - start, o.get("tin", 0), o.get("tout", 0)))
    for a, b, name in OVERLAYS:
        if a <= t < b:
            f = FADE_TEXT.get(name, 0.15)
            put(frame, fr.overlay(name), fade_k(t, a, b - a, f, f))
    # grain over everything (cards too): fine, a little stronger in the dark
    g = GRAIN[int(t * FPS) % len(GRAIN)]
    frame = frame + g * (0.005 + 0.006 * (1 - frame.mean(axis=2, keepdims=True)))
    return (np.clip(frame, 0, 1) * 255 + 0.5).astype(np.uint8)


# ---------------------------------------------------------------- sound
def read(raw, name):
    x, sr = sf.read(str(raw / "audio" / f"{name}.wav"), dtype="float32", always_2d=True)
    assert sr == SR, (name, sr)
    return x


def snap(x, sec, win=0.18):
    """The quietest point near `sec`: a cut between words, never through one."""
    i = int(sec * SR)
    a, b = max(0, i - int(win * SR)), min(len(x), i + int(win * SR))
    if b - a < 960:
        return min(max(i, 0), len(x))
    m = np.abs(x[a:b]).mean(axis=1)
    hop = 240
    e = np.array([m[j:j + hop].mean() for j in range(0, len(m) - hop, hop)])
    return a + int(np.argmin(e)) * hop + hop // 2


def trim_silence(x, thr_db=-50):
    m = np.abs(x).max(axis=1)
    on = np.where(m > 10 ** (thr_db / 20))[0]
    return x[max(0, on[0] - 480):] if len(on) else x


def env(n, fin, fout):
    e = np.ones(n, np.float32)
    a, b = int(fin * SR), int(fout * SR)
    if a:
        e[:a] = np.linspace(0, 1, a) ** 1.5
    if b:
        e[-b:] = np.minimum(e[-b:], np.linspace(1, 0, b) ** 1.5)
    return e


def looped(x, length, xf=1.5):
    """x, repeated to fill `length` seconds, each repeat crossfaded into the next."""
    n = int(length * SR)
    if len(x) >= n:
        return x[:n]
    k = min(int(xf * SR), len(x) // 3)
    ramp = np.linspace(0, 1, k, dtype=np.float32)[:, None]
    out = np.zeros((n, 2), np.float32)
    pos = 0
    while True:
        seg = x.copy()
        if pos:
            seg[:k] *= ramp
        seg[-k:] *= 1 - ramp
        end = min(n, pos + len(seg))
        out[pos:end] += seg[:end - pos]
        if end >= n:
            return out
        pos = end - k


def mix(raw):
    n = int(END * SR)
    buses = {b: np.zeros((n, 2), np.float32) for b in ("vo", "music", "amb", "sfx")}
    for at, name, gain, o in SOUND:
        x = read(raw, name)
        if "cut" in o:
            a, b = o["cut"]
            x = x[snap(x, a, 0.05):snap(x, b, 0.05)] if name.startswith("vo_") else x[int(a * SR):int(b * SR)]
        if name.startswith(("vo_", "sfx_")):
            x = trim_silence(x)
        if "loop" in o:
            x = looped(x, o["loop"])
        x = x * env(len(x), o.get("fin", 0.004), o.get("fout", 0.08 if name.startswith("vo_") else 0.03))[:, None]
        x = x * 10 ** (gain / 20)
        i = int(at * SR)
        j = min(n, i + len(x))
        buses[o.get("bus", "sfx")][i:j] += x[:j - i]
    # the score and the rain step back under the words
    vo = np.abs(buses["vo"]).max(axis=1)
    hop = 480
    lvl = np.array([vo[j:j + hop].max() for j in range(0, n, hop)])
    lvl = np.repeat(lvl, hop)[:n]
    duck = np.zeros(n, np.float32)
    a_att, a_rel = 1 - math.exp(-1 / (0.03 * SR)), 1 - math.exp(-1 / (0.45 * SR))
    target = np.clip(lvl / 0.08, 0, 1)
    d = 0.0
    for k in range(0, n, 48):                                    # (a coarse follower is plenty)
        tv = target[k]
        d += (tv - d) * (1 - (1 - (a_att if tv > d else a_rel)) ** 48)
        duck[k:k + 48] = d
    buses["music"] *= (1 - 0.5 * duck)[:, None]
    buses["amb"] *= (1 - 0.35 * duck)[:, None]
    out = buses["vo"] * 1.0 + buses["music"] * 0.9 + buses["amb"] * 0.85 + buses["sfx"] * 0.9
    # hard cuts to silence
    g = np.ones(n, np.float32)
    for a, b in SILENCE:
        i, j = int(a * SR), int(b * SR)
        g[i:j] = 0
        r = int(0.012 * SR)
        g[i - r:i] = np.minimum(g[i - r:i], np.linspace(1, 0, r))
    out = out * g[:, None]
    # loudness: about -15 LUFS-ish (RMS of the loud parts), peaks held under -1 dBFS
    m = out.mean(axis=1)
    blocks = np.array([np.sqrt(np.mean(m[j:j + SR // 2] ** 2)) for j in range(0, n - SR // 2, SR // 2)])
    loud = blocks[blocks > 10 ** (-40 / 20)]
    rms = np.sqrt(np.mean(loud ** 2)) if len(loud) else 0.1
    out *= 10 ** (-16.5 / 20) / max(rms, 1e-6)
    return limit(out, 10 ** (-1.0 / 20))


def limit(x, ceil):
    """Look-ahead peak limiter: the gain comes down just before a peak, and eases back up after."""
    from scipy.ndimage import minimum_filter1d
    peak = np.abs(x).max(axis=1)
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    need = minimum_filter1d(need, size=2 * int(0.005 * SR) + 1)   # the lowest gain needed within 5 ms
    blk = 32
    nb = len(need) // blk + 1
    nb_need = np.pad(need, (0, nb * blk - len(need)), constant_values=1.0).reshape(nb, blk).min(axis=1)
    g = np.empty(nb, np.float32)
    cur = 1.0
    rel = 1 - math.exp(-blk / (0.12 * SR))
    for k in range(nb):
        cur = nb_need[k] if nb_need[k] < cur else cur + (nb_need[k] - cur) * rel
        g[k] = cur
    g = np.repeat(g, blk)[:len(x)]
    return np.clip(x * g[:, None], -ceil, ceil)


# ---------------------------------------------------------------- out
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("raw")
    ap.add_argument("out")
    ap.add_argument("--preview", nargs=2, type=float)
    ap.add_argument("--frames", default="")
    ap.add_argument("--audio-only", action="store_true")
    args = ap.parse_args()
    raw = Path(args.raw)
    fr = Frames(raw)
    audio = mix(raw)
    sf.write(str(Path(args.out).with_suffix(".wav")), audio, SR)
    if args.audio_only:
        return
    t0, t1 = args.preview or (0.0, END)
    if args.frames:
        Path(args.frames).mkdir(parents=True, exist_ok=True)
        for t in np.arange(t0, t1, 1.0):
            Image.fromarray(picture(float(t), fr)).resize((960, 540)).save(Path(args.frames) / f"{t:05.1f}.png")
        return
    out = av.open(args.out, "w", options={"movflags": "+faststart"})
    vs = out.add_stream("libx264", rate=FPS)
    vs.width, vs.height, vs.pix_fmt = W, H, "yuv420p"
    vs.options = {"crf": "18", "maxrate": "22M", "bufsize": "44M", "preset": "slow", "profile": "high", "tune": "film",
                  "x264-params": "colorprim=bt709:transfer=bt709:colormatrix=bt709:keyint=120"}
    aus = out.add_stream("aac", rate=SR, layout="stereo")
    aus.bit_rate = 256000
    nf = int(round((t1 - t0) * FPS))
    for k in range(nf):
        t = t0 + k / FPS
        vf = av.VideoFrame.from_ndarray(picture(t, fr), format="rgb24")
        vf = vf.reformat(format="yuv420p", dst_colorspace="ITU709", src_colorspace="ITU709")
        vf.pts = k
        for p in vs.encode(vf):
            out.mux(p)
        if k % 600 == 0:
            print(f"{t:6.1f}s", flush=True)
    for p in vs.encode():
        out.mux(p)
    a = audio[int(t0 * SR):int(t1 * SR)].T.copy()
    for k in range(0, a.shape[1], 1024):
        af = av.AudioFrame.from_ndarray(np.ascontiguousarray(a[:, k:k + 1024]), format="fltp", layout="stereo")
        af.sample_rate = SR
        af.pts = k
        for p in aus.encode(af):
            out.mux(p)
    for p in aus.encode():
        out.mux(p)
    out.close()
    print("wrote", args.out, flush=True)


if __name__ == "__main__":
    main()
