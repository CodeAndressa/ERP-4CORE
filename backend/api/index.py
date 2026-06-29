import sys
import os
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_import_error = None
try:
    from app.main import app  # noqa: F401
except Exception as _e:
    _import_error = traceback.format_exc()

if _import_error:
    from fastapi import FastAPI
    app = FastAPI()

    @app.get("/{path:path}")
    async def error_handler(path: str):
        return {"error": "Import failed", "traceback": _import_error}
