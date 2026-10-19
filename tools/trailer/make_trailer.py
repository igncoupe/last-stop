"""Cuts the Steam trailer from footage captured with capture.js/shots.js and sound recorded with sounds.js.

  python tools/trailer/make_trailer.py RAW_DIR OUT.mp4 [--preview SECONDS_FROM SECONDS_TO] [--frames DIR]

RAW_DIR holds one folder of PNG frames per shot (960x540, 60 fps), audio/*.wav (48 kHz) and text/*.png (1920x1080
overlays). Out comes 1920x1080, 60 fps, H.264 (High, BT.709) + AAC 48 kHz stereo, faststart: what Steam asks for.
81 seconds, told in order: 1994, tonight, what goes wrong, who they are, the choice. No jumpscares in it.
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
END = 81.0

# The story, in order: 1994, the tape (the driver asks to wait out the storm; dispatch says make up the time), the
# bridge, fourteen drowned. Tonight: the new driver, the two rules, a stop that shouldn't exist, the drowned at the
# shelter (they just want a ride home). Things get worse. Then who they are: his mother was one of them. Then it
# happens again (make up the time), and the choice: stop for them.
CUT = [
    (0.8, 11.3, "s_bridge_drive", {"src": 0, "fin": 0.9, "lift": 1.15}),
    (11.0, 14.6, "s_wreck_wide", {"src": 0, "fin": 0.3, "fout": 0.5, "lift": 1.6}),
    (14.5, 18.6, "s_storm_ext", {"src": 40, "fin": 0.6, "lift": 1.15}),
    (18.4, 23.4, "n1_oldman", {"src": 0, "fin": 0.5}),
    (23.2, 27.6, "n_display", {"src": 40, "fin": 0.4}),
    (27.4, 32.4, "n2_shelter_close", {"src": 20, "fin": 0.5}),
    (32.2, 35.3, "n2_lena_door", {"src": 50, "fin": 0.5}),
    (35.1, 37.3, "s_fog", {"src": 260, "fin": 0.15}),
    (37.1, 39.95, "s_honk4", {"src": 845, "fin": 0.15}),
    (39.8, 42.25, "s_honk4_close", {"src": 1150, "fin": 0.15}),
    (42.1, 44.75, "n3_window_fog", {"src": 470, "fin": 0.15}),
    (44.6, 48.6, "s_board", {"src": 440, "fin": 0.3}),
    (48.4, 55.9, "s_mom_behind", {"src": 20, "fin": 0.4, "fout": 0.3}),
    (55.7, 58.2, "s_bridge_drive", {"src": 742, "fin": 0.3, "lift": 1.15}),
    (58.0, 62.6, "s_plunge", {"src": 60, "fin": 0.3, "lift": 1.15}),
    (62.4, 64.6, "s_doors", {"src": 0, "fin": 0.3}),
    (64.4, 70.2, "s_turn", {"src": 80, "fin": 0.35}),
    (72.5, 75.6, "n5_fourteen", {"src": 0, "fin": 0.8, "fout": 0.6}),
    (75.6, 78.9, "black", {"text": "title", "tin": 0.6, "flicker": True}),
]

OVERLAYS = [
    (1.3, 6.4, "cap_1994"),
    (1.4, 6.3, "s_t94_river"),
    (6.5, 11.5, "s_r94_neg"),
    (11.9, 14.3, "s_radio_14"),
    (15.0, 18.0, "cap_tonight"),
    (15.1, 20.6, "s_rhee_evening_full"),
    (20.7, 25.5, "s_rhee_rules"),
    (25.6, 30.1, "s_you_display2"),
    (30.3, 35.4, "s_mara_ride"),
    (37.5, 40.5, "s_you_fu"),
    (40.6, 42.1, "s_you_nobody3"),
    (42.4, 44.9, "s_old_listened"),
    (45.0, 52.6, "s_radio_lena"),
    (53.2, 54.5, "s_lena_grew"),
    (54.9, 55.8, "s_you_mom"),
    (56.0, 58.75, "s_rhee_make"),
    (62.8, 65.3, "s_you_comeon"),
    (69.4, 71.1, "s_voices_stay"),
    (71.6, 73.0, "s_lena_hi"),
    (73.2, 75.4, "card_stopfor"),
    (76.8, 78.9, "wishlist"),
    (79.2, 80.9, "s_rhee_seeyou"),
]
FADE_TEXT = {"cap_1994": 0.6, "cap_tonight": 0.6, "card_stopfor": 0.5, "wishlist": 0.5}

V = {"bus": "vo"}
SOUND = [
    # 1994: the storm, the tape, the bridge
    (0.20, "sfx_static", -9, {"cut": (0.1, 1.2)}),
    (0.40, "amb_rain", -4, {"loop": 14.4, "fin": 1.5, "fout": 0.6, "bus": "amb"}),
    (0.60, "mood_dread", -6, {"loop": 14.0, "fin": 2.0, "fout": 0.8, "bus": "music"}),
    (0.80, "amb_rain_engine", -8, {"cut": (2.0, 8.0), "loop": 10.5, "fin": 1.0, "fout": 1.0, "bus": "amb"}),
    (1.40, "vo_ec7960bf", 0, {"cut": (2.2, 7.25), "bus": "vo"}),
    (4.90, "sfx_thunder", -6, {}),
    (6.50, "vo_b861e563", 0, V),
    (10.90, "sfx_thunder", -3, {}),
    (11.05, "sfx_sting", -5, {}),
    (11.90, "vo_a7325815", 0, {"cut": (3.2, 5.97), "bus": "vo"}),
    (14.60, "sfx_thunder", -6, {}),
    # tonight
    (14.50, "amb_rain_engine", -5, {"cut": (2.0, 7.0), "fin": 0.6, "fout": 1.0, "bus": "amb"}),
    (14.50, "mood_uneasy", -3, {"loop": 20.8, "fin": 1.0, "fout": 0.5, "bus": "music"}),
    (15.10, "vo_018b35f7", 0, V),
    (18.40, "amb_rain", -7, {"loop": 17.0, "fin": 1.0, "fout": 0.4, "bus": "amb"}),
    (20.70, "vo_2383af51", 0, {"cut": (3.1, 8.19), "bus": "vo"}),
    (23.25, "sfx_static", -12, {"cut": (0.1, 0.7)}),
    (25.60, "vo_3e6533b0", 0, {"cut": (1.4, 6.22), "bus": "vo"}),
    (30.00, "sfx_whisper", -8, {}),
    (30.30, "vo_97309180", 0, V),
    # it gets worse
    (35.10, "sfx_sting", -5, {}),
    (35.10, "mood_terror", -2, {"loop": 9.5, "fin": 0.2, "fout": 0.5, "bus": "music"}),
    (35.10, "sfx_heartbeat", -6, {}),
    (35.30, "sfx_squeak", -6, {"cut": (0.1, 2.0)}),
    (37.10, "sfx_bang", -8, {}),
    (37.10, "amb_rain_engine", -7, {"cut": (2.0, 7.5), "fin": 0.2, "fout": 0.3, "bus": "amb"}),
    (37.15, "sfx_horn", -6, {"cut": (0.1, 1.4)}),
    (37.50, "vo_83a0fb23", 0, V),
    (39.80, "sfx_bang", -8, {}),
    (39.80, "sfx_rise", -8, {"cut": (0.0, 2.5)}),
    (40.60, "vo_e9e244bf", 0, {"cut": (3.0, 4.77), "bus": "vo"}),
    (42.10, "sfx_bang", -8, {}),
    (42.20, "sfx_squeak", -8, {"cut": (0.1, 2.4)}),
    (42.40, "vo_e19a942e", 0, {"cut": (3.4, 6.22), "bus": "vo"}),
    # who they are
    (44.60, "mood_grief", 0, {"loop": 11.3, "fin": 0.6, "fout": 0.5, "bus": "music"}),
    (44.60, "sfx_door", -9, {}),
    (45.00, "vo_37120f0c", 0, V),
    (48.40, "amb_rain", -13, {"loop": 7.5, "fin": 0.8, "fout": 0.4, "bus": "amb"}),
    (49.00, "sfx_heartbeat", -12, {}),
    (53.20, "vo_4518468c", 0, V),
    (54.90, "vo_9298e7e3", 0, V),
    # and it happens again
    (55.70, "mood_terror", -3, {"loop": 14.5, "fin": 0.3, "fout": 0.05, "bus": "music"}),
    (55.70, "amb_rain_engine", -6, {"cut": (2.0, 8.0), "fin": 0.3, "fout": 0.5, "bus": "amb"}),
    (56.00, "sfx_sting", -2, {}),
    (56.00, "sfx_slam", -4, {}),
    (56.00, "vo_e5be74f8", 2, V),
    (56.10, "sfx_thunder", -2, {}),
    (58.00, "sfx_ignition", -7, {}),
    (58.58, "sfx_scrape", -2, {}),
    (58.58, "sfx_bang", -5, {}),
    (59.10, "sfx_thunder", -5, {}),
    (59.55, "sfx_plunge", 0, {}),
    (59.55, "sfx_slam", -5, {}),
    (59.85, "sfx_gush", -4, {}),
    (60.35, "sfx_splash", -7, {}),
    (62.40, "amb_underwater", 0, {"loop": 7.8, "fin": 0.3, "fout": 0.05, "bus": "amb"}),
    (62.40, "sfx_gush", -4, {}),
    (62.60, "sfx_heartbeat", -4, {}),
    (62.80, "vo_2b0a3f5c", 0, {"cut": (0.0, 2.95), "bus": "vo"}),
    (62.90, "sfx_bang", -2, {}),
    (63.50, "sfx_bang", -2, {}),
    (64.10, "sfx_bang", -2, {}),
    (64.60, "sfx_knock", -5, {}),
    (65.60, "sfx_sting", -6, {}),
    (65.60, "sfx_moan", 0, {"cut": (1.0, 5.5)}),
    (69.15, "sfx_lightsout", 0, {}),
    (69.15, "sfx_bubbles", -4, {}),
    (69.40, "vo_4f1ccf4b", 2, V),
    # stop for them
    (71.40, "mood_grief", 1, {"loop": 9.6, "fin": 1.5, "fout": 1.5, "bus": "music"}),
    (71.60, "vo_6d286338", 0, V),
    (72.30, "amb_rain", -9, {"loop": 8.7, "fin": 1.5, "fout": 1.2, "bus": "amb"}),
    (75.60, "sfx_thunder", 2, {}),
    (75.60, "sfx_slam", -3, {}),
    (79.20, "vo_755b438a", 0, {"cut": (1.5, 3.41), "bus": "vo"}),
    (80.70, "sfx_static", -8, {"cut": (0.1, 0.35)}),
]
SILENCE = []


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
            a = fade_k(t, start, end - start, o.get("tin", 0), o.get("tout", 0))
            if o.get("flicker") and t - start < 0.56:
                a = [1, 0, 1, 0.15, 1, 0.5, 1][int((t - start) / 0.08)]
            put(frame, fr.overlay(o["text"]), a)
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
