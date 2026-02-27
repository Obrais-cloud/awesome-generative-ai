#!/usr/bin/env python3
"""
Dashboard Server — Layer 3 Execution Script

Serves the Content Machine dashboard as a local web application.
Provides API endpoints for the frontend to fetch data and a static
file server for the HTML/CSS/JS assets.

Usage:
  python execution/dashboard_server.py

Then open http://127.0.0.1:8050 in your browser.
"""

import json
import os
import shutil
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

HOST = os.getenv("DASHBOARD_HOST", "127.0.0.1")
PORT = int(os.getenv("DASHBOARD_PORT", "8050"))

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DASHBOARD_DIR = PROJECT_ROOT / "dashboard"
TEMPLATES_DIR = DASHBOARD_DIR / "templates"
STATIC_DIR = DASHBOARD_DIR / "static"
DATA_DIR = DASHBOARD_DIR / "data"
TMP_DIR = PROJECT_ROOT / ".tmp"


def ensure_dirs():
    """Create data directory if needed."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def sync_data_files():
    """Copy latest .tmp data files to dashboard/data/ for serving."""
    mappings = {
        TMP_DIR / "trends.json": DATA_DIR / "trends.json",
        TMP_DIR / "analysis.json": DATA_DIR / "analysis.json",
        # generated_content.json is already written directly to dashboard/data/
    }
    for src, dst in mappings.items():
        if src.exists():
            shutil.copy2(src, dst)
            print(f"[sync] {src.name} -> {dst}")


# ---------------------------------------------------------------------------
# Request Handler
# ---------------------------------------------------------------------------
class DashboardHandler(SimpleHTTPRequestHandler):
    """Custom handler for the dashboard: serves HTML, static files, and API."""

    def __init__(self, *args, **kwargs):
        # Set the serving directory to project root for flexibility
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API endpoints
        if path == "/api/content":
            self.serve_json(DATA_DIR / "generated_content.json")
        elif path == "/api/trends":
            self.serve_json(DATA_DIR / "trends.json")
        elif path == "/api/analysis":
            self.serve_json(DATA_DIR / "analysis.json")
        # Static files
        elif path.startswith("/static/"):
            self.serve_static(path)
        # Root -> serve index.html
        elif path in ("/", "/index.html"):
            self.serve_file(TEMPLATES_DIR / "index.html", "text/html")
        else:
            self.send_error(404, "Not Found")

    def serve_json(self, filepath):
        """Serve a JSON file or return empty object if missing."""
        if filepath.exists():
            data = filepath.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)
        else:
            body = b"[]"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def serve_static(self, path):
        """Serve static files (CSS, JS)."""
        # Remove leading /static/ to get relative path
        rel = path.lstrip("/")
        filepath = PROJECT_ROOT / "dashboard" / rel
        if filepath.exists() and filepath.is_file():
            content_types = {
                ".css": "text/css",
                ".js": "application/javascript",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon",
            }
            ext = filepath.suffix.lower()
            ct = content_types.get(ext, "application/octet-stream")
            self.serve_file(filepath, ct)
        else:
            self.send_error(404, f"Static file not found: {path}")

    def serve_file(self, filepath, content_type):
        """Generic file serve."""
        try:
            data = filepath.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except FileNotFoundError:
            self.send_error(404, "File not found")

    def log_message(self, format, *args):
        """Custom log format."""
        print(f"[dashboard] {args[0]}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run():
    """Start the dashboard server."""
    ensure_dirs()
    sync_data_files()

    port = PORT
    max_attempts = 5
    server = None

    for attempt in range(max_attempts):
        try:
            server = HTTPServer((HOST, port), DashboardHandler)
            break
        except OSError as e:
            if "Address already in use" in str(e) and attempt < max_attempts - 1:
                port += 1
                print(f"[warn] Port {port - 1} in use, trying {port}")
            else:
                raise

    print(f"\n{'=' * 50}")
    print(f"  Content Machine Dashboard")
    print(f"  http://{HOST}:{port}")
    print(f"{'=' * 50}")
    print(f"\n[info] Press Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[info] Shutting down dashboard server")
        server.shutdown()


if __name__ == "__main__":
    run()
