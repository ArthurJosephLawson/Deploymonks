from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DEFAULT_PORT = {{DEFAULT_PORT}}


def _env_int(name: str, fallback: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return fallback
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name}={raw!r} is not an integer") from exc


@dataclass(frozen=True)
class Settings:
    project_name: str = "{{PROJECT_NAME}}"
    author: str = "{{AUTHOR_NAME}}"
    version: str = "0.1.0"
    host: str = field(default_factory=lambda: os.getenv("HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: _env_int("PORT", DEFAULT_PORT))
    reload: bool = field(default_factory=lambda: os.getenv("RELOAD", "1") == "1")
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "info"))

    @property
    def static_dir(self) -> Path:
        return BASE_DIR / "app" / "static"

    @property
    def templates_dir(self) -> Path:
        return BASE_DIR / "app" / "templates"


settings = Settings()
