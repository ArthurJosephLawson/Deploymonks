import path from 'node:path';

import fs from 'fs-extra';

import { templateError } from './errors.js';
import { getTemplatesRoot } from '../utils/paths.js';

export type TemplateId = 'fastapi-tailwind' | 'node-express';

export type TemplateDefinition = {
  readonly id: TemplateId;
  readonly label: string;
  readonly description: string;
  readonly stack: readonly string[];
  readonly packageManager: 'pip' | 'npm';
  readonly defaultPort: number;
  readonly portLabel: string;
  readonly nextSteps: readonly string[];
};

export const TEMPLATES: readonly TemplateDefinition[] = [
  {
    id: 'fastapi-tailwind',
    label: 'FastAPI + Tailwind',
    description: 'Python API service with a Tailwind CSS front-end pipeline.',
    stack: ['Python 3.10+', 'FastAPI', 'Uvicorn', 'Tailwind CSS'],
    packageManager: 'pip',
    defaultPort: 8000,
    portLabel: 'Uvicorn port',
    nextSteps: [
      'python3 -m venv .venv && source .venv/bin/activate',
      'pip install -r requirements.txt',
      'npm install && npm run watch:css   # Tailwind watch build',
      'python run.py                      # serves on port {{DEFAULT_PORT}}',
    ],
  },
  {
    id: 'node-express',
    label: 'Node + Express',
    description: 'Type-safe-by-convention Node.js HTTP service with a health endpoint.',
    stack: ['Node 18+', 'Express', 'dotenv', 'node:test'],
    packageManager: 'npm',
    defaultPort: 3000,
    portLabel: 'HTTP port',
    nextSteps: ['npm run dev', 'npm test', 'curl http://localhost:{{DEFAULT_PORT}}/api/health'],
  },
] as const;

export const DEFAULT_TEMPLATE_ID: TemplateId = 'node-express';

export function listTemplateIds(): readonly TemplateId[] {
  return TEMPLATES.map((template) => template.id);
}

export function isTemplateId(value: string): value is TemplateId {
  return listTemplateIds().some((id) => id === value);
}

export function getTemplate(id: TemplateId): TemplateDefinition {
  const template = TEMPLATES.find((candidate) => candidate.id === id);
  if (template === undefined) {
    throw templateError(`Unknown template "${id}".`, [
      `Available templates: ${listTemplateIds().join(', ')}`,
    ]);
  }
  return template;
}

export const TEMPLATE_RENAMES: Readonly<Record<string, string>> = {
  _gitignore: '.gitignore',
  _npmrc: '.npmrc',
  _env: '.env',
};

export type CopyResult = {
  readonly templateDir: string;
  readonly files: readonly string[];
};

const IGNORED_TEMPLATE_ENTRIES = new Set([
  '.DS_Store',
  '.git',
  'node_modules',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'dist',
  '.mypy_cache',
  '.ruff_cache',
]);

export function resolveTemplateDir(id: TemplateId): string {
  const templateDir = path.join(getTemplatesRoot(), id);
  if (!fs.existsSync(templateDir)) {
    throw templateError(`Template "${id}" is missing from this installation.`, [
      `Expected it at: ${templateDir}`,
      'Reinstall deploymonk with: npm install -g deploymonk',
    ]);
  }
  return templateDir;
}

export async function listTemplateFiles(id: TemplateId): Promise<readonly string[]> {
  const templateDir = resolveTemplateDir(id);
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (IGNORED_TEMPLATE_ENTRIES.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        found.push(path.relative(templateDir, full));
      }
    }
  };
  await walk(templateDir);
  return found;
}

export async function copyTemplate(id: TemplateId, targetDir: string): Promise<CopyResult> {
  const templateDir = resolveTemplateDir(id);

  try {
    await fs.ensureDir(targetDir);
  } catch (cause) {
    throw templateError(`Could not create the target directory: ${targetDir}`, [
      cause instanceof Error ? cause.message : String(cause),
    ]);
  }

  try {
    await fs.copy(templateDir, targetDir, {
      overwrite: true,
      errorOnExist: false,
      dereference: true,
      filter: (source) => {
        const relative = path.relative(templateDir, source);
        if (relative === '') return true;
        const [first = ''] = relative.split(path.sep);
        return !IGNORED_TEMPLATE_ENTRIES.has(first);
      },
    });
  } catch (cause) {
    throw templateError(`Failed to copy the "${id}" template into ${targetDir}.`, [
      cause instanceof Error ? cause.message : String(cause),
    ]);
  }

  const files = await listTemplateFiles(id);
  return { templateDir, files: files.map((file) => path.join(targetDir, file)) };
}
