from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from ..config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "project": settings.project_name,
        "version": settings.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/ready")
async def ready() -> dict[str, object]:
    return {"status": "ready", "project": settings.project_name}
