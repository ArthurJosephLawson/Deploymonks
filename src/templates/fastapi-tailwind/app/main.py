from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .landing import render_landing_page
from .routers import health_router

logger = logging.getLogger("{{PACKAGE_NAME}}")

DESCRIPTION = (
    "{{PROJECT_NAME}} is a FastAPI service scaffolded by DeployMonk. "
    "Maintained by {{AUTHOR_NAME}}."
)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logger.info("starting %s v%s", settings.project_name, settings.version)
    logger.info("listening on http://%s:%s", settings.host, settings.port)
    yield
    logger.info("stopping %s", settings.project_name)


app = FastAPI(
    title=settings.project_name,
    description=DESCRIPTION,
    version=settings.version,
    lifespan=lifespan,
)

app.include_router(health_router, prefix="/api")

if settings.static_dir.is_dir():
    app.mount("/static", StaticFiles(directory=str(settings.static_dir)), name="static")


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def index() -> HTMLResponse:
    return HTMLResponse(content=render_landing_page())
