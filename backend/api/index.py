from fastapi import FastAPI

app = FastAPI()

@app.get("/{path:path}")
async def probe(path: str):
    import sys, os
    info = {
        "python": sys.version,
        "cwd": os.getcwd(),
        "path": sys.path[:5],
    }
    # Try importing each dependency step by step
    results = {}
    for mod in ["sqlalchemy", "psycopg2", "passlib", "jose", "pydantic_settings", "fastapi"]:
        try:
            __import__(mod)
            results[mod] = "ok"
        except Exception as e:
            results[mod] = str(e)
    info["imports"] = results

    # Try importing app modules
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    for mod in ["app.core.config", "app.database.session", "app.core.security", "app.main"]:
        try:
            __import__(mod)
            results[mod] = "ok"
        except Exception as e:
            results[mod] = str(e)

    return info
