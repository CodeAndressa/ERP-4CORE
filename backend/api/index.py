import sys
import os

# Add backend root to sys.path so `app.*` imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.server import app  # noqa: F401  — Vercel picks up `app` as the ASGI entrypoint
