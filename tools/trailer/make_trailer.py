"""Cuts the Steam trailer from footage captured with capture.js/shots.js and sound recorded with sounds.js.

  python tools/trailer/make_trailer.py RAW_DIR OUT.mp4 [--preview SECONDS_FROM SECONDS_TO] [--frames DIR]

RAW_DIR holds one folder of PNG frames per shot (960x540, 30 fps), audio/*.wav (48 kHz) and text/*.png (1920x1080
overlays). Out comes 1920x1080, 30 fps, H.264 (High, BT.709) + AAC 48 kHz stereo, faststart: what Steam asks for.
"""
import argparse
import math
from pathlib import Path

import av
import numpy as np
import soundfile as sf
from PIL import Image

FPS = 30
W, H = 1920, 1080
SR = 48000

# ---------------------------------------------------------------- the cut
# (start, length, what, options). What: a shot's name (frames from `src`), "black", or a card (text over black).
# Times are seconds on the trailer.
CUT = [
    (0.00, 2.00, "black", {}),
    (2.00, 4.15, "s01_storm_ext", {"src": 4, "fin": 0.8}),
    (6.15, 2.25, "black", {"text": "card_route9", "tin": 0.35, "tout": 0.4}),
    (8.40, 4.80, "n1_oldman", {"src": 0, "fin": 0.3}),
    (13.20, 4.20, "n_display", {"src": 0}),
    (17.40, 2.60, "black", {"text": "card_stop", "tin": 0.3, "tout": 0.35}),
    (20.00, 3.20, "n2_shelter_close", {"src": 20, "fin": 0.4}),
    (23.20, 2.80, "n2_lena_door", {"src": 70}),
    (26.00, 3.00, "s_fog", {"src": 110}),
    (29.00, 2.60, "s_honk", {"src": 430}),
    (31.60, 2.80, "s_honk", {"src": 560}),
    (34.40, 0.50, "s_honk", {"src": 776, "flash": 2, "shake": 14}),
    (34.90, 0.40, "black", {}),
    (35.30, 2.00, "n3_teodor_bed", {"src": 0, "fin": 0.25}),
    (37.30, 3.00, "n3_window_fog", {"src": 225}),
    (40.30, 1.50, "n1_windshield", {"src": 18, "hit": 41.10}),
    (41.80, 2.80, "s_board", {"src": 250}),
    (44.60, 4.00, "s_mom_behind3", {"src": 40}),
    (48.60, 2.40, "s_bridge_ext", {"src": 230}),
    (51.00, 0.90, "black", {}),
    (51.90, 2.40, "s_edge_ext", {"src": 60}),
    (54.30, 2.00, "s_plunge", {"src": 138, "hit": 54.70}),
    (56.30, 1.50, "s_flood_in", {"src": 30}),
    (57.80, 1.20, "s_doors", {"src": 10}),
    (59.00, 3.00, "s_turn", {"src": 20}),
    (62.00, 1.30, "s_turn", {"src": 160}),
    (63.30, 1.00, "s_turn", {"src": 228}),
    (64.30, 0.80, "s_turn", {"src": 270}),
    (65.10, 0.70, "s_turn", {"src": 296}),
    (65.80, 0.40, "s_turn", {"src": 318, "flash": 2, "shake": 18}),
    (66.20, 2.20, "black", {}),
    (68.40, 3.20, "n5_fourteen", {"src": 40, "fin": 0.8, "fout": 0.6}),
    (71.60, 5.40, "black", {"text": "title", "tin": 1.2}),
    (77.00, 4.00, "black", {}),
]
END = 81.0
# words on screen: (from, to, png); cards are in CUT
OVERLAYS = [
    (2.60, 5.70, "s_rhee_evening"),
    (8.80, 13.50, "s_rhee_rules"),
    (13.50, 19.60, "s_you_display"),
    (20.60, 26.00, "s_mara_ride"),
    (29.20, 32.00, "s_you_fu"),
    (31.55, 34.40, "s_you_nobody2"),
    (35.60, 37.10, "s_old_late"),
    (41.60, 46.20, "s_you_doors2"),
    (46.60, 47.90, "s_lena_grew"),
    (48.00, 48.65, "s_you_mom"),
    (48.90, 50.95, "s_rhee_eleven"),
    (51.05, 53.00, "s_rhee_make"),
    (53.00, 55.20, "s_rhee_faster"),
    (56.30, 58.10, "s_you_ohshit"),
    (58.10, 60.80, "s_you_comeon"),
    (63.30, 65.10, "s_voices_stay"),
    (67.30, 68.90, "s_lena_hi"),
    (69.50, 71.50, "card_stopfor"),
    (73.80, 77.00, "wishlist"),
    (77.30, 80.80, "s_rhee_tomorrow"),
]
FADE_TEXT = {"card_stopfor": 0.4, "wishlist": 0.6}

# sound: (at, wav, gain dB, options). Options: cut=(from, to) seconds in the file (snapped to the quiet between
# words), fin/fout fades, loop=length to fill (crossfaded), bus="vo"|"music"|"amb"|"sfx"
SOUND = [
    (0.30, "amb_rain", -3, {"loop": 21.0, "fin": 1.8, "fout": 1.5, "bus": "amb"}),
    (1.55, "sfx_static", -9, {"cut": (0.1, 1.2), "bus": "sfx"}),
    (2.20, "amb_rain_engine", -4, {"cut": (2.0, 7.0), "fin": 1.2, "fout": 1.3, "bus": "amb"}),
    (2.60, "vo_018b35f7", 0, {"cut": (0.0, 3.35), "bus": "vo"}),
    (6.15, "sfx_bang", -7, {"bus": "sfx"}),
    (6.15, "mood_uneasy", -3, {"loop": 14.0, "fin": 0.8, "fout": 1.6, "bus": "music"}),
    (8.80, "vo_2383af51", 0, {"cut": (3.30, 8.19), "bus": "vo"}),
    (13.25, "sfx_static", -11, {"cut": (0.1, 0.7), "bus": "sfx"}),
    (13.50, "vo_3e6533b0", 0, {"bus": "vo"}),
    (17.40, "sfx_bang", -9, {"bus": "sfx"}),
    (19.20, "mood_dread", -2, {"loop": 29.4, "fin": 2.0, "fout": 0.4, "bus": "music"}),
    (20.00, "amb_rain", -7, {"loop": 14.4, "fin": 0.8, "fout": 0.3, "bus": "amb"}),
    (20.60, "vo_97309180", 0, {"bus": "vo"}),
    (26.20, "sfx_squeak", -5, {"bus": "sfx"}),
    (28.90, "sfx_horn", -5, {"cut": (0.1, 1.5), "bus": "sfx"}),
    (29.20, "vo_83a0fb23", 0, {"bus": "vo"}),
    (31.45, "vo_e9e244bf", 0, {"cut": (1.85, 4.77), "bus": "vo"}),
    (34.40, "sfx_sting", 0, {"bus": "sfx"}),
    (34.40, "sfx_scream", -1, {"cut": (0.0, 0.55), "fout": 0.05, "bus": "sfx"}),
    (34.40, "sfx_slam", -2, {"bus": "sfx"}),
    (35.30, "sfx_beeps", -10, {"cut": (0.1, 2.2), "bus": "sfx"}),
    (35.60, "vo_c8b7b688", 0, {"bus": "vo"}),
    (37.35, "sfx_squeak", -7, {"cut": (0.1, 3.0), "bus": "sfx"}),
    (38.55, "sfx_rise", -4, {"bus": "sfx"}),
    (40.35, "sfx_shriek", -6, {"cut": (0.1, 1.2), "bus": "sfx"}),
    (41.10, "sfx_slam", 0, {"bus": "sfx"}),
    (41.12, "sfx_crack", -4, {"bus": "sfx"}),
    (41.60, "vo_0cfa0f8e", 0, {"cut": (0.0, 4.55), "bus": "vo"}),
    (41.80, "sfx_door", -9, {"bus": "sfx"}),
    (46.60, "vo_4518468c", 0, {"bus": "vo"}),
    (48.00, "vo_9298e7e3", 0, {"bus": "vo"}),
    (48.40, "sfx_rise", -6, {"cut": (0.0, 3.0), "bus": "sfx"}),
    (48.60, "mood_terror", -3, {"loop": 17.6, "fin": 0.6, "fout": 0.05, "bus": "music"}),
    (48.60, "amb_rain", -6, {"loop": 2.4, "fin": 0.2, "fout": 0.2, "bus": "amb"}),
    (48.90, "vo_ce82045a", 0, {"bus": "vo"}),
    (51.00, "sfx_sting", 0, {"bus": "sfx"}),
    (51.00, "sfx_slam", 0, {"bus": "sfx"}),
    (51.05, "vo_e5be74f8", 2, {"bus": "vo"}),
    (53.00, "vo_8937e20f", 0, {"cut": (0.0, 2.35), "bus": "vo"}),
    (54.70, "sfx_splash", 0, {"bus": "sfx"}),
    (54.85, "sfx_gush", -2, {"bus": "sfx"}),
    (56.30, "amb_underwater", 0, {"loop": 9.9, "fin": 0.3, "fout": 0.05, "bus": "amb"}),
    (56.30, "vo_c8838305", 0, {"cut": (0.0, 1.95), "bus": "vo"}),
    (57.95, "sfx_bang", -2, {"bus": "sfx"}),
    (58.10, "vo_2b0a3f5c", 0, {"cut": (0.0, 2.95), "bus": "vo"}),
    (58.55, "sfx_bang", -2, {"bus": "sfx"}),
    (59.10, "sfx_heartbeat", -3, {"bus": "sfx"}),
    (60.15, "sfx_knock", -4, {"bus": "sfx"}),
    (60.70, "sfx_sting", -1, {"bus": "sfx"}),
    (60.70, "sfx_moan", 0, {"cut": (1.0, 6.5), "bus": "sfx"}),
    (62.00, "sfx_lightsout", 0, {"bus": "sfx"}),
    (62.00, "sfx_bubbles", -4, {"bus": "sfx"}),
    (63.30, "vo_4f1ccf4b", 2, {"bus": "vo"}),
    (64.30, "sfx_lightsout", 0, {"bus": "sfx"}),
    (65.80, "sfx_sting", 1, {"bus": "sfx"}),
    (65.80, "sfx_scream", 0, {"cut": (0.0, 0.45), "fout": 0.04, "bus": "sfx"}),
    (65.80, "sfx_slam", 0, {"bus": "sfx"}),
    (67.30, "vo_6d286338", 0, {"bus": "vo"}),
    (68.40, "mood_grief", 1, {"loop": 9.0, "fin": 1.6, "fout": 2.0, "bus": "music"}),
    (68.40, "amb_rain", -8, {"loop": 12.6, "fin": 1.5, "fout": 1.0, "bus": "amb"}),
    (71.60, "sfx_thunder", 2, {"bus": "sfx"}),
    (71.60, "sfx_slam", -3, {"bus": "sfx"}),
    (77.30, "vo_755b438a", 0, {"bus": "vo"}),
    (80.75, "sfx_static", -8, {"cut": (0.1, 0.35), "bus": "sfx"}),
]
# everything goes quiet (a hard cut to silence after a scare): (from, to)
SILENCE = [(34.90, 35.30), (66.20, 67.20)]


# ---------------------------------------------------------------- picture
def vignette():
    y, x = np.mgrid[0:H // 2, 0:W // 2].astype(np.float32)
    nx, ny = (x - W / 4) / (W / 4), (y - H / 4) / (H / 4)
    r = np.sqrt(nx * nx * 0.9 + ny * ny * 1.1)
    return np.clip(1.0 - 0.42 * np.clip(r - 0.35, 0, None) ** 1.6, 0.45, 1.0)[..., None].astype(np.float32)


VIG = vignette()
RNG = np.random.default_rng(1994)


def grade(img):
    """The look: a little darker, crushed shadows with a cold cast, slightly drained color."""
    x = img.astype(np.float32) / 255.0
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
    seg = next((s for s in CUT if s[0] <= t < s[0] + s[1]), None)
    frame = np.zeros((H, W, 3), np.float32)
    if seg:
        start, length, what, o = seg
        if what != "black":
            i = o.get("src", 0) + int(round((t - start) * FPS))
            img = grade(fr.shot(what, i))
            img = up(img)
            sh = o.get("shake", 0)
            if sh:
                amp = sh * max(0.0, 1 - (t - start) / length)
                img = np.roll(img, (int(RNG.integers(-amp, amp + 1)), int(RNG.integers(-amp, amp + 1))), axis=(0, 1))
            frame = img * fade_k(t, start, length, o.get("fin", 0), o.get("fout", 0))
            if o.get("flash") and (t - start) * FPS < o["flash"]:
                frame = frame * 0.3 + 0.75
        if o.get("text"):
            put(frame, fr.overlay(o["text"]), fade_k(t, start, length, o.get("tin", 0), o.get("tout", 0)))
    for a, b, name in OVERLAYS:
        if a <= t < b:
            f = FADE_TEXT.get(name, 0.08)
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
            x = x[snap(x, a):snap(x, b)] if name.startswith("vo_") else x[int(a * SR):int(b * SR)]
        elif name.startswith(("vo_", "sfx_")):
            x = trim_silence(x)
        if "loop" in o:
            x = looped(x, o["loop"])
        x = x * env(len(x), o.get("fin", 0.004), o.get("fout", 0.03 if name.startswith("vo_") else 0.02))[:, None]
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
    vs.options = {"crf": "18", "maxrate": "16M", "bufsize": "32M", "preset": "slow", "profile": "high", "tune": "film",
                  "x264-params": "colorprim=bt709:transfer=bt709:colormatrix=bt709:keyint=60"}
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
        if k % 150 == 0:
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
