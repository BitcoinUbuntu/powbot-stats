"""
Simple HTTP server for local dashboard testing.

Usage:
    python serve.py

Then open http://localhost:8080 in your browser.

Every response tells the browser not to cache it, so after a `git pull` or an
edit a normal reload shows the new files. Local testing only; the live site
(GitHub Pages) sets its own caching.
"""

import http.server
import socketserver

PORT = 8080


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


class Server(socketserver.TCPServer):
    # Restarting straight after Ctrl+C would otherwise fail with
    # "address already in use" while the old socket times out.
    allow_reuse_address = True


print(f"Serving at http://localhost:{PORT}")
print("Press Ctrl+C to stop (on Windows, Ctrl+Break if Ctrl+C does nothing)")

with Server(("", PORT), NoCacheHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped")
