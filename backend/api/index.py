import sys
import os
import json


# Pure ASGI app — zero dependencies beyond stdlib
async def app(scope, receive, send):
    if scope["type"] != "http":
        return

    path = scope.get("path", "/")
    info = {
        "path": path,
        "python": sys.version,
        "cwd": os.getcwd(),
    }

    # Try importing fastapi
    try:
        import fastapi
        info["fastapi"] = fastapi.__version__
    except Exception as e:
        info["fastapi_error"] = str(e)

    # Try importing app.server
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    try:
        import app.server
        info["app_server"] = "ok"
    except Exception as e:
        info["app_server_error"] = str(e)[:500]

    body = json.dumps(info).encode()
    await send({"type": "http.response.start", "status": 200, "headers": [[b"content-type", b"application/json"]]})
    await send({"type": "http.response.body", "body": body})
