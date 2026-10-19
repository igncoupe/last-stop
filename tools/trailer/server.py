"""The game, served locally, plus somewhere for the trailer capture to put what it records.

  python tools/trailer/server.py OUT_DIR [port]          (needs NumPy and Pillow for /__frame)

GET serves the repo like any static server.
POST /__save?path=shot/0001.png writes the request body to OUT_DIR/shot/0001.png (paths stay inside OUT_DIR).
POST /__frame?path=shot/0001.png&w=960&h=540&fade=0&white=0&uw=0&drown=0 takes raw RGBA pixels straight from the
GPU (bottom row first), lays the page's own overlays over them (the fade to black or white, the underwater murk and the
running-out-of-air vignette, as the CSS draws them) and writes a PNG. Doing this here, not in the page, keeps the
capture fast even when the browser gives a page in the background very little time.
"""
import http.server
import sys
import urllib.parse
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]).resolve()
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765


@lru_cache(maxsize=8)
def ellipse_r(w, h, cx, cy):
    """For a CSS radial-gradient(ellipse at cx cy): how far each pixel is along the gradient (0 center, 1 corner)."""
    import numpy as np
    x0, y0 = cx * w, cy * h
    rx, ry = max(x0, w - x0) * 2 ** 0.5, max(y0, h - y0) * 2 ** 0.5
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return np.sqrt(((x - x0) / rx) ** 2 + ((y - y0) / ry) ** 2)


def gradient(r, stops):
    """stops: [(offset, (r, g, b, a)), ...] -> an (h, w, 4) float image."""
    import numpy as np
    offs = np.array([s[0] for s in stops], np.float32)
    cols = np.array([s[1] for s in stops], np.float32)
    out = np.empty(r.shape + (4,), np.float32)
    for k in range(4):
        out[..., k] = np.interp(r, offs, cols[:, k])
    return out


def over(img, layer):
    a = layer[..., 3:4]
    return img * (1 - a) + layer[..., :3] * a


def frame_png(body, q, dest):
    import numpy as np
    from PIL import Image
    w, h = int(q["w"]), int(q["h"])
    img = np.frombuffer(body, np.uint8).reshape(h, w, 4)[::-1, :, :3].astype(np.float32) / 255.0
    uw, drown, fade = float(q.get("uw", 0)), float(q.get("drown", 0)), float(q.get("fade", 0))
    if uw > 0.002:
        r = ellipse_r(w, h, 0.5, 0.42)
        img = over(img, gradient(r, [(0, (30 / 255, 80 / 255, 70 / 255, 0.1 * uw)), (0.6, (4 / 255, 22 / 255, 18 / 255, 0.45 * uw)),
                                     (1, (0, 6 / 255, 5 / 255, 0.88 * uw))]))
        if drown > 0.01:
            r2 = ellipse_r(w, h, 0.5, 0.46)
            img = over(img, gradient(r2, [(0, (0, 0, 0, 0)), (0.3, (0, 0, 0, 0)), (0.6, (0, 0, 0, 0.6 * drown)),
                                          (0.88, (0, 0, 0, 0.96 * drown)), (1.5, (0, 0, 0, 0.96 * drown))]))
    if fade > 0.003:
        c = (244 / 255, 241 / 255, 234 / 255) if q.get("white") == "1" else (0, 0, 0)
        img = img * (1 - fade) + np.array(c, np.float32) * fade
    Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(dest, compress_level=1)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(url.query).items()}
        if url.path not in ("/__save", "/__frame"):
            self.send_error(404)
            return
        rel = q.get("path", "")
        dest = (OUT / rel).resolve()
        if OUT not in dest.parents or not rel:
            self.send_error(400, "bad path")
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if url.path == "/__frame":
            frame_png(body, q, dest)
        else:
            dest.write_bytes(body)
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")            # always the files as they are now
        super().end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
