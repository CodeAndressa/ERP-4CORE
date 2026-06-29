import sys, os, traceback
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_err = None
try:
    from app.server import app
except Exception:
    _err = traceback.format_exc()

if _err:
    from fastapi import FastAPI
    app = FastAPI()

    @app.get("/{path:path}")
    async def _show_error(path: str):
        return {"import_error": _err}
