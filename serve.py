"""
Simple HTTP server for local dashboard testing.

Usage:
    python serve.py

Then open http://localhost:8080 in your browser.
"""

import http.server
import socketserver

PORT = 8080

Handler = http.server.SimpleHTTPRequestHandler

print(f"Serving at http://localhost:{PORT}")
print("Press Ctrl+C to stop")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
