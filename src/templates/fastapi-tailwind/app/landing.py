from __future__ import annotations

from .config import Settings, settings

_STYLES = """
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      background: #0f172a;
      color: #e2e8f0;
    }
    main { max-width: 42rem; padding: 3rem; }
    h1 { font-size: 2.25rem; margin: 0 0 0.5rem; }
    p { line-height: 1.7; color: #94a3b8; }
    code {
      background: #1e293b;
      border-radius: 0.375rem;
      padding: 0.15rem 0.4rem;
      font-size: 0.9em;
    }
    ul { line-height: 1.9; color: #cbd5f5; }
    footer { margin-top: 2.5rem; font-size: 0.8rem; color: #64748b; }
"""


def render_landing_page(config: Settings | None = None) -> str:
    active = config or settings
    endpoints = "".join(
        f"<li><code>{path}</code> &rarr; {summary}</li>"
        for path, summary in (
            ("GET /", "this page"),
            ("GET /api/health", "liveness probe"),
            ("GET /api/health/ready", "readiness probe"),
            ("GET /docs", "interactive OpenAPI documentation"),
            ("GET /static/css/main.css", "compiled Tailwind bundle"),
        )
    )
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{active.project_name}</title>
    <link rel="stylesheet" href="/static/css/main.css" />
    <style>{_STYLES}</style>
  </head>
  <body>
    <main>
      <h1>{active.project_name}</h1>
      <p>
        A FastAPI service scaffolded by <strong>DeployMonk</strong>,
        maintained by {active.author}.
      </p>
      <p>
        It is listening on port <code>{active.port}</code> and exposes:
      </p>
      <ul>{endpoints}</ul>
      <footer>Version {active.version}</footer>
    </main>
  </body>
</html>
"""
