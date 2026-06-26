from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.session import engine, Base
from app.models.contracts import Contract, Order
from app.routes import auth, dashboard, financial, leads, clients, proposals, marketing, knowledge, ai, site_analytics, integrations, contracts
app=FastAPI(title="4Core",version="0.1.0")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
Base.metadata.create_all(bind=engine)
for router in [auth.router,dashboard.router,financial.router,leads.router,clients.router,proposals.router,marketing.router,knowledge.router,ai.router,site_analytics.router,integrations.router,contracts.router]: app.include_router(router)
@app.get('/health')
def health_check(): return {'status':'ok'}