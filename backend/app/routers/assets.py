"""Read-only access to bundled assets (audio, textures, fonts, ...)."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import ALLOWED_ASSET_EXTENSIONS, ASSETS_ROOT

router = APIRouter()

_ASSETS_ROOT = ASSETS_ROOT.resolve()


@router.get("/assets/{path:path}")
def get_asset(path: str) -> FileResponse:
    """Serve a whitelisted file inside the assets root, rejecting traversal."""
    if not path or path.endswith(("/", "\\")):
        raise HTTPException(status_code=404, detail="asset not found")

    candidate = (_ASSETS_ROOT / path).resolve()
    try:
        candidate.relative_to(_ASSETS_ROOT)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="asset not found") from exc

    if candidate.suffix.lower() not in ALLOWED_ASSET_EXTENSIONS:
        raise HTTPException(status_code=404, detail="asset not found")
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="asset not found")

    return FileResponse(
        candidate,
        headers={"Cache-Control": "public, max-age=86400"},
    )
