# {{PROJECT_NAME}}

An Express HTTP service scaffolded by
[DeployMonk](https://www.npmjs.com/package/deploymonk).

- **Author:** {{AUTHOR_NAME}}
- **Default port:** `{{DEFAULT_PORT}}`
- **Stack:** Node.js 18+, Express, dotenv, `node:test`

## Project layout

```
{{PROJECT_NAME}}/
├── src/
│   ├── index.js                    # process entrypoint, graceful shutdown
│   ├── app.js                      # Express app factory
│   ├── config/
│   │   └── index.js                # environment driven configuration
│   ├── controllers/
│   │   └── healthController.js     # health + info handlers
│   ├── middleware/
│   │   ├── errorHandler.js         # central JSON error handler
│   │   ├── notFound.js             # JSON 404
│   │   └── requestLogger.js        # one JSON line per request
│   ├── routes/
│   │   ├── healthRoutes.js         # /api/health
│   │   └── index.js                # root router
│   └── utils/
│       └── logger.js               # dependency free logger
├── tests/
│   └── health.test.js              # node:test smoke suite
├── .env.example
└── package.json
```

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer

## Setup

```bash
npm install
cp .env.example .env
```

## Run

```bash
npm run dev     # node --watch src/index.js
npm start       # plain node
```

Then open <http://127.0.0.1:{{DEFAULT_PORT}}/>.

### Endpoints

| Method | Path           | Description                     |
| ------ | -------------- | ------------------------------- |
| GET    | `/`            | Service metadata                |
| GET    | `/api/health`  | Health probe (used by monitors) |
| GET    | `/api/info`    | Runtime configuration snapshot  |

## Tests

```bash
npm test
```

The suite boots the real app on an ephemeral port and uses the built-in
`node:test` runner, so no additional test dependencies are required.

## Configuration

Every value can be overridden with environment variables (see `.env.example`):

| Variable      | Default          | Description                       |
| ------------- | ---------------- | --------------------------------- |
| `NODE_ENV`    | `development`    | Runtime environment               |
| `HOST`        | `127.0.0.1`      | Bind address                      |
| `PORT`        | `{{DEFAULT_PORT}}`       | HTTP port                         |
| `LOG_REQUESTS`| `1`              | `1` logs one line per request     |
