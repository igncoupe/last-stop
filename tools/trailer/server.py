"""The game, served locally, plus somewhere for the trailer capture to put what it records.

  python tools/trailer/server.py OUT_DIR [port]

GET serves the repo like any static server. POST /__save?path=shot/0001.png writes the request body to
OUT_DIR/shot/0001.png (paths stay inside OUT_DIR).
"""
import http.server
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]).resolve()
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        if url.path != "/__save":
            self.send_error(404)
            return
        rel = urllib.parse.parse_qs(url.query).get("path", [""])[0]
        dest = (OUT / rel).resolve()
        if OUT not in dest.parents or not rel:
            self.send_error(400, "bad path")
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        n = int(self.headers.get("Content-Length", 0))
        dest.write_bytes(self.rfile.read(n))
        self.send_response(204)
        self.end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
