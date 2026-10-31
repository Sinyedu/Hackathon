import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.api import assistant, catalog, health, reconciliations, recovery, sessions
from app.core.config import get_settings
from app.services import speech
from app.services.inbox import watch
from app.services.suppliers import seed_suppliers


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    seed_suppliers()
    watcher = asyncio.create_task(watch())
    warmup = asyncio.create_task(asyncio.to_thread(speech.warm))  # background: never blocks startup
    try:
        yield
    finally:
        watcher.cancel()
        warmup.cancel()
        try:
            await watcher
        except asyncio.CancelledError:
            pass


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
app.include_router(sessions.router, prefix="/api")
app.include_router(recovery.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")

frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="frontend-assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        return FileResponse(frontend_dist / "index.html")
