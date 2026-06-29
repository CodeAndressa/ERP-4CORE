import sys
import os

# Adiciona o diretório raiz do backend ao path do Python
# Para que "from app.main import app" funcione
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: F401 — Vercel detecta este "app" como handler ASGI
