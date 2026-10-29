"""Serve the mode/rule configuration consumed by the frontend."""
from __future__ import annotations

import json
from functools import lru_cache

from fastapi import APIRouter, HTTPException

from app.config import PROJECT_ROOT
from app.schemas import GameConfig
from app.version import __version__

router = APIRouter()

_DATA_FILE = PROJECT_ROOT / "backend" / "app" / "data" / "game.json"


@lru_cache(maxsize=1)
def _load_game_config() -> dict:
    try:
        data = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot read {_DATA_FILE}: {exc}") from exc
    data["version"] = __version__
    data.setdefault("assetsBase", "/api/assets")
    return data


@router.get("/config", response_model=GameConfig)
def get_config() -> dict:
    """Return modes, rule flags and the asset base path."""
    try:
        return _load_game_config()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
