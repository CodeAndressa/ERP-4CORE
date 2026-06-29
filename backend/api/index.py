import sys
import os

# Ensure the backend root is in sys.path so `from app.xxx import` works
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.server import app  # noqa: F401  — Vercel ASGI handler
