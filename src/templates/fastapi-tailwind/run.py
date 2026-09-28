from __future__ import annotations

import argparse

import uvicorn

from app.config import settings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run {{PROJECT_NAME}}")
    parser.add_argument("--host", default=settings.host)
    parser.add_argument("--port", type=int, default={{DEFAULT_PORT}})
    parser.add_argument("--prod", action="store_true", help="disable auto-reload")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=False if args.prod else settings.reload,
    )


if __name__ == "__main__":
    main()
