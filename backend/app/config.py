"""Runtime configuration loaded from the project-root config.json."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]

_DEFAULT_CONFIG: dict[str, Any] = {
    "host": "127.0.0.1",
    "port": 8000,
    "open_browser": True,
    "assets_root": "backend/assets",
    "serve_frontend": True,
    "log_enabled": False,
    "log_path": "mahj.log",
}


def _load_config() -> dict[str, Any]:
    config = dict(_DEFAULT_CONFIG)
    path = PROJECT_ROOT / "config.json"
    if not path.exists():
        return config
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return config
    if isinstance(loaded, dict):
        config.update(loaded)
    return config


_CONFIG = _load_config()

HOST: str = str(_CONFIG.get("host", "127.0.0.1"))
PORT: int = int(_CONFIG.get("port", 8000))
OPEN_BROWSER: bool = bool(_CONFIG.get("open_browser", True))
SERVE_FRONTEND: bool = bool(_CONFIG.get("serve_frontend", True))
LOG_ENABLED: bool = bool(_CONFIG.get("log_enabled", False))
LOG_PATH: str = str(_CONFIG.get("log_path", "mahj.log"))

_assets_raw = str(_CONFIG.get("assets_root") or "backend/assets")
_assets_path = Path(_assets_raw)
if not _assets_path.is_absolute():
    _assets_path = PROJECT_ROOT / _assets_path
ASSETS_ROOT: Path = _assets_path.resolve()

FRONTEND_DIST: Path = PROJECT_ROOT / "frontend" / "dist"

ALLOWED_ASSET_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".svg",
        ".gif",
        ".ogg",
        ".mp3",
        ".wav",
        ".woff",
        ".woff2",
        ".ttf",
        ".otf",
        ".glb",
        ".gltf",
        ".hdr",
    }
)
