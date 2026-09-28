# {{PROJECT_NAME}}

A FastAPI service with a Tailwind CSS front-end pipeline, scaffolded by
[DeployMonk](https://www.npmjs.com/package/deploymonk).

- **Author:** {{AUTHOR_NAME}}
- **Default port:** `{{DEFAULT_PORT}}`
- **Stack:** Python 3.10+, FastAPI, Uvicorn, Tailwind CSS

## Project layout

```
{{PROJECT_NAME}}/
├── app/
│   ├── __init__.py
│   ├── config.py            # environment driven settings
│   ├── landing.py           # HTML landing page
│   ├── main.py              # FastAPI application
│   ├── routers/
│   │   ├── __init__.py
│   │   └── health.py        # /api/health and /api/health/ready
│   └── static/css/
│       └── input.css        # Tailwind entrypoint
├── tests/
│   └── test_app.py          # python -m unittest
├── .env.example
├── package.json             # Tailwind build scripts only
├── requirements.txt
├── run.py                   # convenience launcher
└── tailwind.config.js
```

## Prerequisites

- Python 3.10 or newer
- Node 18+ (only needed if you want the Tailwind pipeline)

## Setup

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
python run.py
# or, without the launcher:
uvicorn app.main:app --reload --port {{DEFAULT_PORT}}
```

Then open <http://127.0.0.1:{{DEFAULT_PORT}}/>.

### Endpoints

| Method | Path                    | Description                     |
| ------ | ----------------------- | ------------------------------- |
| GET    | `/`                     | HTML landing page               |
| GET    | `/api/health`           | Liveness probe                  |
| GET    | `/api/health/ready`     | Readiness probe                 |
| GET    | `/docs`                 | Interactive OpenAPI documentation |

## Tailwind CSS

The Tailwind source file is `app/static/css/input.css`; the compiled bundle is
written to `app/static/css/main.css` and served at `/static/css/main.css`.

```bash
npm install
npm run build:css   # one-off production build
npm run watch:css   # rebuild on every change
```

Until the bundle exists the landing page falls back to the inline stylesheet in
`app/landing.py`, so the service is usable without Node installed.

## Configuration

Every setting can be overridden with environment variables (see
`.env.example`):

| Variable    | Default     | Description                       |
| ----------- | ----------- | --------------------------------- |
| `HOST`      | `127.0.0.1` | Bind address                      |
| `PORT`      | `{{DEFAULT_PORT}}` | HTTP port                  |
| `RELOAD`    | `1`         | `1` enables uvicorn auto-reload   |
| `LOG_LEVEL` | `info`      | Logging level                     |

## Tests

```bash
python -m unittest discover -s tests -t .
```
