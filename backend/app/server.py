import re

from jose import JWTError, jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from app.core.config import settings
from app.database.session import engine, Base, SessionLocal
from app.database.schema import ensure_runtime_schema
from app.models.commercial import Lead, Proposal
from app.models.contracts import Contract, Order
from app.routes import auth, dashboard, financial, leads, clients, proposals, marketing, knowledge, ai, site_analytics, integrations, contracts
from app.services.bootstrap_service import ensure_bootstrap_admin


VERCEL_ORIGIN_RE = re.compile(r"^https://[a-z0-9-]+\.vercel\.app$")


def _cors_origins() -> list[str]:
    configured = [origin.strip().rstrip('/') for origin in settings.cors_origins.split(',') if origin.strip()]
    defaults = [
        'http://127.0.0.1:5174',
        'http://localhost:5174',
        'https://erp-4-core.vercel.app',
        'https://4core.site',
        'https://www.4core.site',
        'https://app.4core.site',
    ]
    return sorted(set(configured + defaults))


ALLOWED_CORS_ORIGINS = set(_cors_origins())
PUBLIC_PATHS = {'/health', '/auth/login', '/auth/register'}


def _is_allowed_origin(origin: str | None) -> bool:
    if not origin:
        return False
    normalized = origin.rstrip('/')
    return normalized in ALLOWED_CORS_ORIGINS or bool(VERCEL_ORIGIN_RE.fullmatch(normalized))


def _with_cors(request: Request, response: Response) -> Response:
    origin = request.headers.get('origin')
    if _is_allowed_origin(origin):
        response.headers['Access-Control-Allow-Origin'] = origin.rstrip('/')
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        vary = response.headers.get('Vary')
        if not vary:
            response.headers['Vary'] = 'Origin'
        elif 'Origin' not in vary:
            response.headers['Vary'] = f'{vary}, Origin'
    return response


app = FastAPI(title='4Core', version='0.1.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_CORS_ORIGINS),
    allow_origin_regex=r'https://[a-z0-9-]+\.vercel\.app',
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.middleware('http')
async def require_authentication(request: Request, call_next):
    if request.method == 'OPTIONS' or request.url.path in PUBLIC_PATHS or request.url.path.startswith('/marketing/meta'):
        response = await call_next(request)
        return _with_cors(request, response)

    authorization = request.headers.get('authorization', '')
    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'bearer' or not token:
        return _with_cors(request, JSONResponse({'detail': 'Autenticacao necessaria'}, status_code=401))

    try:
        jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return _with_cors(request, JSONResponse({'detail': 'Sessao expirada. Faca login novamente.'}, status_code=401))

    try:
        response = await call_next(request)
    except Exception:
        return _with_cors(request, JSONResponse({'detail': 'Erro interno na API.'}, status_code=500))
    return _with_cors(request, response)


@app.on_event('startup')
def on_startup():
    Base.metadata.create_all(bind=engine)
    if ensure_runtime_schema(engine):
        Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_bootstrap_admin(db)
    finally:
        db.close()


for router in [auth.router, dashboard.router, financial.router, leads.router, clients.router, proposals.router, marketing.router, knowledge.router, ai.router, site_analytics.router, integrations.router, contracts.router]:
    app.include_router(router)


@app.get('/health')
def health_check():
    return {'status': 'ok'}
