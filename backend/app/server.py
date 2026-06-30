from jose import JWTError, jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.database.session import engine, Base, SessionLocal
from app.database.schema import ensure_runtime_schema
from app.models.commercial import Lead, Proposal
from app.models.contracts import Contract, Order
from app.routes import auth, dashboard, financial, leads, clients, proposals, marketing, knowledge, ai, site_analytics, integrations, contracts
from app.services.bootstrap_service import ensure_bootstrap_admin


def _cors_origins() -> list[str]:
    return [origin.strip() for origin in settings.cors_origins.split(',') if origin.strip()]


PUBLIC_PATHS = {'/health', '/auth/login', '/auth/register'}


app = FastAPI(title='4Core', version='0.1.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.middleware('http')
async def require_authentication(request: Request, call_next):
    if request.method == 'OPTIONS' or request.url.path in PUBLIC_PATHS:
        return await call_next(request)

    authorization = request.headers.get('authorization', '')
    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'bearer' or not token:
        return JSONResponse({'detail': 'Autenticacao necessaria'}, status_code=401)

    try:
        jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return JSONResponse({'detail': 'Sessao expirada. Faca login novamente.'}, status_code=401)

    return await call_next(request)


@app.on_event('startup')
def on_startup():
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema(engine)
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

