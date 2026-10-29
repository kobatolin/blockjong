"""Pydantic response models for the public API."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ModeConfig(BaseModel):
    id: str
    name: str
    rows: int = Field(gt=0)
    cols: int = Field(gt=0)
    suits: list[str]
    copies: int = Field(gt=0)


class RulesConfig(BaseModel):
    flowerMatch: str = "group"
    dragSegment: str = "push"


class GameConfig(BaseModel):
    version: str
    modes: list[ModeConfig]
    rules: RulesConfig
    assetsBase: str = "/api/assets"
