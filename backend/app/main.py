from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import catalog, health, reconciliations, recovery
from app.core.config import get_settings
from app.core.db import init_db
from app.services.suppliers import seed_suppliers


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    seed_suppliers()  # idempotent: never overwrites existing rows
    yield


app = FastAPI(title="DockProof API", lifespan=lifespan)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list,
    allow_origin_regex=_settings.cors_origin_regex or None,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
app.include_router(reconciliations.router, prefix="/api")
app.include_router(recovery.router, prefix="/api")
