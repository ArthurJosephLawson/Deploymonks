# DeployMonk

> Scaffold polished, full-stack project boilerplates into any directory — straight from a friendly interactive terminal.

```text
________                .__                                           __            
\______ \   ____ ______ |  |   ____ ___.__.      _____   ____   ____ |  | __  ______
 |    |  \_/ __ \\____ \|  |  /  _ <   |  |     /     \ /  _ \ /    \|  |/ / /  ___/
 |    `   \  ___/|  |_> >  |_(  <_> )___  |    |  Y Y  (  <_> )   |  \    <  \___ \ 
/_______  /\___  >   __/|____/\____// ____|____|__|_|  /\____/|___|  /__|_ \/____  >
        \/     \/|__|               \/   /_____/     \/            \/     \/     \/ 
```

DeployMonk is a zero-configuration command line scaffolder. It asks a handful of
questions, then writes a complete, runnable, already-tested project into a
directory of your choosing — placeholders substituted, dependencies installed,
and a manifest written so you always know what generated the tree.

It is deliberately **boring and predictable**: one replacement engine, no
telemetry, no network calls you did not ask for, and an exit code you can rely
on in CI.

[![npm version](https://img.shields.io/npm/v/deploymonk.svg)](https://www.npmjs.com/package/deploymonk)
[![npm downloads](https://img.shields.io/npm/dm/deploymonk.svg)](https://www.npmjs.com/package/deploymonk)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-5FA04E.svg)](https://nodejs.org)

---

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Requirements](#requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Usage Examples](#usage-examples)
- [Templates](#templates)
- [Programmatic API](#programmatic-api)
- [How It Works](#how-it-works)
- [Exit Codes](#exit-codes)
- [Contributing](#contributing)
- [License](#license)
- [Author & Maintainer](#author--maintainer)

---

## Key Features

- **Interactive by default, scriptable when it matters** — a friendly prompt flow
  in a terminal, and a complete flag-driven mode (`--yes`) for CI and automation.
- **Two production-shaped templates** — a Node + Express service and a FastAPI +
  Tailwind service, both with a health endpoint and their own passing test suite.
- **Deterministic placeholder substitution** — a single replacement engine with a
  hard guarantee that **zero** `{{ ... }}` constructs survive generation.
- **Safe overwrite handling** — `abort`, `merge` and `replace` strategies, with
  protection against writing into the filesystem root, your home folder, or a
  path that already exists as a file.
- **Dependency installation that reports honestly** — `npm` and `pip` are probed
  before use, PEP 668 systems fall back to a project-local virtual environment,
  and a failed install is never swallowed.
- **Correct exit codes everywhere** — `0` on success, `1` on any user-correctable
  or runtime failure. Nothing exits with a surprise code.
- **Graceful in CI** — spinners degrade to plain lines when stdout is not a TTY,
  and colour is disabled automatically under `NO_COLOR` or `TERM=dumb`.
- **Reproducible output** — two runs on the same input produce byte-identical
  trees, which is what makes the result reviewable in a pull request.
- **Zero-configuration templates** — generated projects carry **no** test-runner
  dependency beyond what the language ships with (`node:test` / `unittest`).

## Tech Stack

| Layer       | Choice                                         |
| ----------- | ---------------------------------------------- |
| Runtime     | Node.js >= 18, native ESM                      |
| Language    | TypeScript (strict, `NodeNext`)                |
| Build       | `tsc` → `dist/`, declarations + source maps    |
| Prompts     | `inquirer`                                     |
| Spinners    | `ora` (TTY-aware, degrades to plain lines)     |
| Colour      | `chalk` (auto-disabled when not a TTY)         |
| Filesystem  | `fs-extra`                                     |
| Tests       | `node:test` + `tsx` loader, zero extra runtime |
| Lint/format | ESLint (`@typescript-eslint`) + Prettier       |
| License     | MIT                                            |

## Requirements

- **Node.js >= 18** and npm.
- A real terminal for the interactive flow. Otherwise pass `--name` (or `--yes`).

Templates may need extra tooling at runtime. DeployMonk **detects and reports**
it, and never assumes it:

| Template           | Requires                                                           |
| ------------------ | ------------------------------------------------------------------ |
| `fastapi-tailwind` | Python 3.10+ (pip or venv), optionally Node for the Tailwind build |
| `node-express`     | Node 18+, npm                                                      |

## Installation

```bash
npm install -g deploymonk
```

Verify the install:

```bash
deploymonk --version
deploymonk --list
```

### Run from source

```bash
git clone https://github.com/monk_mango/deploymonk.git
cd deploymonk
npm install
npm run build
npm link          # exposes the `deploymonk` command globally
```

You can also skip `npm link` entirely and invoke the launcher directly:

```bash
node bin/deploymonk.cjs --help
```

### Configuration

DeployMonk has **no configuration file and no environment variables to set**.
Everything is either a prompt answer, a flag, or standard terminal conventions it
respects automatically:

| Variable           | Effect                                      |
| ------------------ | ------------------------------------------- |
| `NO_COLOR`         | Disables all colour output                  |
| `FORCE_COLOR=0`    | Disables all colour output                  |
| `TERM=dumb`        | Disables colour and animation               |
| `DEPLOYMONK_DEBUG` | Set to `1` to print stack traces on failure |

## Getting Started

Run it with no arguments and answer the questions:

```bash
deploymonk
```

You will be asked for:

1. **Project name** — becomes the directory name, the package name and the title.
2. **Template** — `node-express` or `fastapi-tailwind`.
3. **Target directory** — defaults to `./<project-name>`.
4. **Author name** _(optional)_ — written into the generated manifest.
5. **Port** — pre-filled with the template default.
6. **Overwrite strategy** — only asked when the target already has files in it.
7. **Dependency install** — run it now, or leave it to you.

DeployMonk then creates the project, resolves every placeholder, installs
dependencies, prints a summary and exits `0`.

## Usage

```text
Usage
  deploymonk                       Start the interactive scaffolder
  deploymonk --list                List the bundled templates
  deploymonk -n my-api -t node-express -d ./out --yes

Options
  -n, --name <name>            Project name (letters, digits, "-", "_")
  -t, --template <id>         fastapi-tailwind | node-express
  -d, --dir <path>             Target directory (default: ./<project-name>)
  -a, --author <name>          Author name written into the project
  -p, --port <number>          Default port (1-65535)
      --overwrite <mode>       abort | merge | replace  (default: abort)
      --force                  Shorthand for --overwrite replace
      --install <mode>         always | auto | never   (default: auto)
      --no-install             Shorthand for --install never
  -y, --yes                    Non-interactive run (requires --name)
      --dry-run                Print the plan without writing anything
      --list                   List the bundled templates
  -h, --help                   Show this help
  -v, --version                Show the version
      --no-color               Disable coloured output
      --debug                  Print stack traces

Exit codes
  0  success
  1  invalid input or a failed operation
```

## Usage Examples

Scaffold an Express service into `./my-api` with the default port:

```bash
deploymonk -n my-api --yes
```

Preview a FastAPI project without writing anything to disk:

```bash
deploymonk -n blog -t fastapi-tailwind -d ./blog --no-install --dry-run
```

Fully non-interactive, suitable for a CI step:

```bash
deploymonk \
  --name my-api \
  --template node-express \
  --dir ./out \
  --port 3000 \
  --author "Ada Lovelace" \
  --no-install \
  --yes
```

Merge into a directory that already has your own files (your files are kept):

```bash
deploymonk -n my-api --overwrite merge --yes
```

Wipe the target directory and regenerate it from scratch:

```bash
deploymonk -n my-api --force --yes
```

See the failure contract — every one of these exits `1`:

```bash
deploymonk -n "bad name" --yes        # invalid project name
deploymonk -n ok --template nope --yes   # unknown template
deploymonk -n ok --port 70000 --yes   # port out of range
deploymonk --totally-unknown          # unknown flag
```

## Templates

Run `deploymonk --list` to see the registry at runtime — the CLI, the help text
and the installer all read the same source of truth, so they can never drift.

### `node-express` — Node + Express

A convention-over-configuration Express service with JSON logging, a central
error handler, a health endpoint and a dependency-free `node:test` suite.

```text
my-api/
├── src/
│   ├── index.js                 process entrypoint, graceful shutdown
│   ├── app.js                   Express app factory
│   ├── config/index.js          environment driven configuration
│   ├── controllers/healthController.js
│   ├── middleware/
│   │   ├── errorHandler.js      central JSON error handler
│   │   ├── notFound.js          JSON 404
│   │   └── requestLogger.js     one JSON line per request
│   ├── routes/
│   │   ├── healthRoutes.js      /api/health
│   │   └── index.js             root router
│   └── utils/logger.js          dependency free logger
├── tests/health.test.js         node:test suite
├── .env.example
├── .gitignore
└── package.json
```

```bash
cd my-api
npm install
npm run dev                      # http://127.0.0.1:3000
npm test
```

### `fastapi-tailwind` — FastAPI + Tailwind

A FastAPI service with environment-driven settings, liveness and readiness
probes, and a Tailwind CSS build pipeline (optional — the landing page works
without Node).

```text
blog/
├── app/
│   ├── __init__.py
│   ├── config.py                settings, DEFAULT_PORT 8000
│   ├── landing.py               HTML landing page
│   ├── main.py                  FastAPI application
│   ├── routers/health.py        /api/health, /api/health/ready
│   └── static/css/input.css     Tailwind entrypoint
├── tests/test_app.py            python -m unittest
├── .env.example
├── .gitignore
├── package.json                 Tailwind build scripts
├── requirements.txt
├── run.py                       convenience launcher
└── tailwind.config.js
```

```bash
cd blog
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py                    # http://127.0.0.1:8000
python -m unittest discover -s tests -t .
```

On PEP 668 managed systems (external environments that refuse `pip install`),
DeployMonk automatically creates a project-local `.venv` and installs there
instead of failing the run.

## Programmatic API

Everything the terminal can do is also exported for scripts, tests and custom
front-ends. DeployMonk is ESM-only.

```ts
import { scaffoldProject, getTemplate, listTemplateIds } from 'deploymonk';

const result = await scaffoldProject({
  projectName: 'Analytics Service',
  templateId: 'node-express',
  targetDir: './out/analytics',
  authorName: 'Ada Lovelace',
  defaultPort: 4242,
  overwrite: 'abort',
  install: 'never',
  onProgress: (phase, message) => console.log(phase, message),
});

console.log(result.values.packageName); // "analytics-service"
console.log(result.fileCount);
```

Generate files without touching the network at all:

```ts
import { generateProject } from 'deploymonk';

const { targetDir, replacementResult, values } = await generateProject({
  projectName: 'Analytics Service',
  templateId: 'fastapi-tailwind',
  targetDir: './out/analytics',
  defaultPort: 8000,
});
```

### API surface

| Export                                               | Purpose                                          |
| ---------------------------------------------------- | ------------------------------------------------ |
| `main(argv?)`                                        | Run the CLI in-process                           |
| `TEMPLATES`, `getTemplate`, `listTemplateIds`        | The template registry                            |
| `isTemplateId`, `DEFAULT_TEMPLATE_ID`                | Template id guards                               |
| `scaffoldProject`, `generateProject`                 | Full pipeline, and generation without installing |
| `resolveProjectValues`, `buildReplacements`          | Build the placeholder value map                  |
| `slugify`, `toPackageName`                           | Naming helpers                                   |
| `replaceInString`, `replaceInFile`                   | Single-value and single-file replacement         |
| `replacePlaceholdersInTree`                          | Walk a tree and rewrite every eligible text file |
| `assertNoUnresolvedPlaceholders`                     | Fail loudly if any `{{ ... }}` survived          |
| `findUnresolvedPlaceholders`, `extractTokens`        | Report leftovers instead of throwing             |
| `isTextFile`, `looksBinary`, `PLACEHOLDER_KEYS`      | Classification helpers                           |
| `prepareTargetDirectory`, `pathExists`, `countFiles` | Filesystem helpers                               |
| `installDependencies`                                | Install for a generated project                  |
| `probeCommand`, `runCommand`, `collectSystemReport`  | Environment probing                              |
| `DeployMonkError`, `describeCause`                   | Error vocabulary                                 |

## How It Works

1. **Validate** — the project name, port and directory are checked before
   anything is written. Bad input fails immediately, with a hint.
2. **Prepare** — the target directory is created, or the overwrite strategy is
   applied.
3. **Copy** — the template is copied through `fs-extra` with junk filtering
   (no `node_modules`, `.venv`, `__pycache__`, caches).
4. **Rename** — dotfiles that npm strips from tarballs (`_gitignore`) are
   restored to their real names.
5. **Replace** — one placeholder engine rewrites every text file.
6. **Manifest** — `.deploymonk.json` records the generator, version, template and
   resolved values.
7. **Verify** — the tree is scanned and generation **fails** if any
   `{{ ... }}` construct remains.
8. **Install** — dependencies are installed for the generated project, with a
   clear report on failure.

### Placeholders

| Placeholder        | Example value       |
| ------------------ | ------------------- |
| `{{PROJECT_NAME}}` | `My API`            |
| `{{PACKAGE_NAME}}` | `my-api` (npm-safe) |
| `{{AUTHOR_NAME}}`  | `Ada Lovelace`      |
| `{{DEFAULT_PORT}}` | `3000`              |
| `{{PROJECT_SLUG}}` | `my-api`            |
| `{{PROJECT_YEAR}}` | `2026`              |

Text files are detected by extension (`.js`, `.ts`, `.json`, `.md`, `.py`,
`.css`, `.txt`, `.yml`, `.yaml`, `.toml`, ...) plus a set of well-known file
names (`Dockerfile`, `Makefile`, `_gitignore`, ...) and a binary sniff. Files
larger than 2 MB and detected binaries are left untouched, and the original
line endings are preserved.

## Exit Codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| `0`  | Success                                 |
| `1`  | Invalid input, or a failed runtime step |

The exit code is written exactly once per process, from a single exit point.

## Contributing

Contributions are welcome — issues, bug reports, template ideas and pull
requests alike.

**Before you open a pull request:**

1. Fork the repository and create a topic branch.
2. Run the full verification suite — it is the same command CI runs:

   ```bash
   npm install
   npm run verify
   ```

   `verify` runs typecheck → format check → lint → build → unit tests → an
   end-to-end smoke test that scaffolds both templates and runs the generated
   Node project's own test suite.

3. Keep the diff focused, and match the existing style: TypeScript with
   `import type` for type-only imports, no `any`, relative imports with an
   explicit `.js` extension, and Prettier-formatted files.

**Adding a template:**

1. Create `src/templates/<id>/`.
2. Register it in `TEMPLATES` in `src/core/copyTemplates.ts` (label,
   description, stack, package manager, default port, next steps).
3. Ship dotfiles with an underscore prefix (`_gitignore`) — npm strips real
   dotfiles from tarballs.
4. Use only the documented placeholders. Generation fails loudly if you leave an
   unresolved `{{ ... }}`, and templates must never contain literal double curly
   braces.
5. Add a scaffold test in `tests/scaffold.test.ts` and a CLI check in
   `scripts/smoke.mjs`.

**Commit messages:** imperative mood, scoped where it helps — for example
`feat(templates): add a Django starter`.

## License

Released under the [MIT License](./LICENSE).

```text
MIT License

Copyright (c) 2026 ArthurJosephLawson
```

## Author & Maintainer

**Developer:** [ArthurJosephLawson](https://github.com/monk_mango) (`@monk_mango`)

**Background:** Freelance Software Engineer | Principal, Scriptmonks

ArthurJosephLawson is an **independent software development freelancer** and the
**Principal / Chief Executive of Scriptmonks**. DeployMonk is authored,
maintained and released by him.

- GitHub: [@monk_mango](https://github.com/monk_mango)
- Issues and feature requests: [github.com/monk_mango/deploymonk/issues](https://github.com/monk_mango/deploymonk/issues)

Contributions, bug reports and template requests are all welcome.

---

<p align="center">
  <sub>Scaffolding full-stack projects, one monk at a time.</sub>
</p>
