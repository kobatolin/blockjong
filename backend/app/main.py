"""FastAPI entry point.

Serves the read-only game configuration and bundled assets. All gameplay
runs in the browser; this service keeps no session state.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import FRONTEND_DIST, SERVE_FRONTEND
from app.routers import assets, config as config_router
from app.version import __version__

app = FastAPI(title="Blockjong", version=__version__)

# The Vite dev server runs on a different origin during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(config_router.router, prefix="/api")
app.include_router(assets.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness probe used by the frontend and by manual checks."""
    return {"status": "ok", "version": __version__}


if SERVE_FRONTEND and FRONTEND_DIST.is_dir():
    app.mount(
        "/",
        StaticFiles(directory=str(FRONTEND_DIST), html=True),
        name="frontend",
    )
else:

    @app.get("/")
    def api_only() -> dict[str, str]:
        return {
            "name": "mahj",
            "status": "api-only",
            "hint": "run `npm run build` in frontend/ or use the Vite dev server",
        }
