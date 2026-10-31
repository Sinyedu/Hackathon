from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, reconciliations

app = FastAPI(title="DockProof API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(reconciliations.router, prefix="/api")
