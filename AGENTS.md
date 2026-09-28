# AGENTS.md — DeployMonk

Guidance for working on this codebase. DeployMonk is a Node.js CLI (TypeScript,
ESM) that scaffolds full-stack project boilerplates with an interactive
terminal experience.

**Owner:** ArthurJosephLawson (`@monk_mango`) — independent software development
freelancer and Principal / Chief Executive of Scriptmonks.

## Non-negotiable rules

1. **No empty `catch` blocks.** Every `catch` must rethrow, return/exit with a
   meaningful error, or log a structured error and rethrow. `DeployMonkError`
   (in `src/core/errors.ts`) is the shared error type; its `kind` drives the
   exit code and the rendered message.
2. **Strict filesystem handling.** Use `fs-extra` with `await`. Every read,
   write, copy or rename failure is converted with `filesystemError(operation,
target, cause)` — operation and affected path are always named. Never ignore
   a failed write/copy.
3. **Exit codes.** `0` on success, `1` on any user-correctable or runtime
   failure. Non-interactive use without required flags is also `1`.
   `src/cli/exit.ts` is the single exit point (`exitWithError`, `finalize`).
   `main()` in `src/cli/index.ts` never throws — it always reports through
   `exitWithError`.
4. **Verification after every major step.** The following must pass before
   work is considered done:
   - `npm run typecheck`
   - `npm run lint` (ESLint with `--max-warnings=0`)
   - `npm run format:check` (Prettier)
   - `npm run build`
   - `npm test`
   - `npm run smoke` (end-to-end: builds, drives the compiled CLI, executes the
     generated Node project's own tests)
   - Everything is zipped by `npm run verify`.
5. **Zero broken imports / zero failing builds.** If the code cannot compile,
   fix it immediately.
6. **Reproducible output.** Deterministic file naming, consistent templates,
   templates excluded from Prettier/ESLint/tsc (`src/templates/`), sorted
   directory traversal in `placeholders.ts`.
7. **No code comments.** The codebase carries no inline, block or JSDoc
   comments and no generated-by banners. Names must carry the intent. Shebangs
   and the `#!/usr/bin/env node` first line are the only permitted comments,
   and Markdown documentation is not code.

## Architecture

- `src/cli/` — entry point (`index.ts`), prompts (`promptFlow.ts`), shared
  validators (`validate.ts`), exit handling (`exit.ts`).
- `src/core/` — orchestration (`scaffold.ts`), template registry and copying
  (`copyTemplates.ts`), the **single** replacement engine
  (`placeholders.ts`), safe filesystem helpers (`filesystem.ts`), dependency
  installer (`installer.ts`), environment probing (`systemCheck.ts`), error
  vocabulary (`errors.ts`).
- `src/templates/` — bundled template sources (`fastapi-tailwind`,
  `node-express`). Templates are excluded from compilation, linting and
  formatting on purpose.
- `src/utils/` — logging (`log.ts`), spinners (`spinner.ts`), path resolution
  (`paths.ts`).
- `bin/deploymonk.cjs` — CommonJS launcher using dynamic `import()` so the
  published package works on every Node >= 18 runtime.
- `tests/` — `node:test` suites (validate, placeholders, scaffold, cli). The
  real exit-code contract is asserted by `scripts/smoke.mjs`.
- `scripts/` — `clean.mjs`, `smoke.mjs` (idempotent, dependency-free).

## Conventions

- **Module system:** ESM (`"type": "module"` in package.json). Relative
  imports use the explicit `.js` extension (NodeNext).
- **Placeholders:** `{{PROJECT_NAME}}`, `{{PACKAGE_NAME}}`, `{{AUTHOR_NAME}}`,
  `{{DEFAULT_PORT}}`, `{{PROJECT_SLUG}}`, `{{PROJECT_YEAR}}`. All replacement
  logic lives in `src/core/placeholders.ts` and is reused everywhere. After
  generation, `assertNoUnresolvedPlaceholders` fails the scaffold if any
  `{{ ... }}` construct remains in a generated file. Templates must therefore
  never contain literal double-curly braces.
- **Validators** in `src/cli/validate.ts` are shared by the prompts and the
  flags so both entry points behave identically.
- **Spinners** (`src/utils/spinner.ts`) degrade to plain lines when the output
  stream is not a TTY.
- No `console.log` in `src/` — use `src/utils/log.ts`. No `any` — TypeScript
  runs with strict mode plus `noUncheckedIndexedAccess`, `verbatimModuleSyntax`
  (use `import type`), `noUnusedLocals`, `noUnusedParameters`.
- Generated-template files are plain Node ES modules / Python modules with zero
  extra test dependencies (`node:test` / `unittest`).
- Files are formatted with Prettier (`npm run format`); keep lines <= 100
  columns. README/AGENTS markdown uses `proseWrap: preserve`.

## Adding a new template

1. Create a folder under `src/templates/<id>/` and register it in
   `TEMPLATES` inside `src/core/copyTemplates.ts` (label, description, stack,
   package manager, default port, next steps).
2. Dotfiles (`gitignore`, `npmrc`, ...) must ship with an underscore prefix
   (`_gitignore`) because npm strips them from tarballs; `applyTemplateRenames`
   renames them back during scaffolding.
3. Only use known placeholders; the scaffold will fail generation if you leave
   any `{{ ... }}` unresolved.
4. Add a scaffold test in `tests/scaffold.test.ts` and a CLI check in
   `scripts/smoke.mjs`.
5. Run `npm run verify`.
