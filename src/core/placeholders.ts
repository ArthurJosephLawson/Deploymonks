import path from 'node:path';

import fs from 'fs-extra';

import { describeCause, filesystemError, templateError } from './errors.js';

export const PLACEHOLDER_KEYS = [
  'PROJECT_NAME',
  'PACKAGE_NAME',
  'AUTHOR_NAME',
  'DEFAULT_PORT',
  'PROJECT_SLUG',
  'PROJECT_YEAR',
] as const;

export type PlaceholderKey = (typeof PLACEHOLDER_KEYS)[number];

const TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
const TOKEN_PRESENCE_PATTERN = /\{\{\s*[A-Za-z0-9_]+\s*\}\}/;
const ANY_TOKEN_PATTERN = /\{\{[^}\n]*\}\}/g;

const TEXT_EXTENSIONS = new Set([
  '.bash',
  '.cfg',
  '.cjs',
  '.conf',
  '.css',
  '.env',
  '.example',
  '.gitignore',
  '.html',
  '.ini',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.php',
  '.py',
  '.rb',
  '.sh',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
  '.zsh',
]);

const FILENAMES_WITHOUT_EXTENSION = new Set([
  'Dockerfile',
  'LICENSE',
  'Makefile',
  'Procfile',
  '_gitignore',
  '_npmrc',
  'docker-compose',
]);

export const MAX_REPLACEABLE_FILE_BYTES = 2 * 1024 * 1024;

export type Replacements = ReadonlyMap<string, string>;

export type ReplacementResult = {
  readonly scannedFiles: number;
  readonly modifiedFiles: readonly string[];
  readonly skippedFiles: readonly string[];
};

export type UnresolvedPlaceholder = {
  readonly file: string;
  readonly placeholders: readonly string[];
};

export function isTextFile(filePath: string): boolean {
  const base = path.basename(filePath);
  if (FILENAMES_WITHOUT_EXTENSION.has(base)) return true;
  const ext = path.extname(base).toLowerCase();
  if (ext === '') return false;
  if (TEXT_EXTENSIONS.has(ext)) return true;
  return base.startsWith('.env');
}

export function looksBinary(buffer: Buffer): boolean {
  const window = buffer.subarray(0, 8192);
  return window.includes(0);
}

function detectNewline(content: string): '\n' | '\r\n' {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function applyReplacements(content: string, replacements: Replacements): string {
  return content.replace(TOKEN_PATTERN, (match, key: string) => {
    const value = replacements.get(key.trim());
    return value === undefined ? match : value;
  });
}

export function replaceInString(content: string, replacements: Replacements): string {
  return applyReplacements(content, replacements);
}

export function extractTokens(content: string): readonly string[] {
  const matches = content.match(ANY_TOKEN_PATTERN);
  return matches === null ? [] : [...new Set(matches)];
}

export async function replaceInFile(
  filePath: string,
  replacements: Replacements
): Promise<boolean> {
  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch (cause) {
    throw filesystemError('stat file', filePath, cause);
  }

  if (!stats.isFile()) return false;
  if (stats.size > MAX_REPLACEABLE_FILE_BYTES) return false;

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (cause) {
    throw filesystemError('read file', filePath, cause);
  }

  if (looksBinary(buffer)) return false;

  const original = buffer.toString('utf8');
  if (!TOKEN_PRESENCE_PATTERN.test(original)) {
    return false;
  }

  const newline = detectNewline(original);
  const replaced = applyReplacements(original, replacements).replace(/\r\n/g, '\n');
  const output = newline === '\r\n' ? replaced.replace(/\n/g, '\r\n') : replaced;

  if (output === original) return false;

  try {
    await fs.writeFile(filePath, output, 'utf8');
  } catch (cause) {
    throw filesystemError('write file', filePath, cause);
  }
  return true;
}

async function collectFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (cause) {
      throw filesystemError('read directory', dir, cause);
    }
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of sorted) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        found.push(full);
      }
    }
  };
  await walk(root);
  return found;
}

export async function replacePlaceholdersInTree(
  root: string,
  replacements: Replacements
): Promise<ReplacementResult> {
  const files = await collectFiles(root);
  const modified: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (!isTextFile(file)) {
      skipped.push(file);
      continue;
    }
    const didChange = await replaceInFile(file, replacements);
    if (didChange) modified.push(file);
  }

  return {
    scannedFiles: files.length,
    modifiedFiles: modified,
    skippedFiles: skipped,
  };
}

export async function findUnresolvedPlaceholders(
  root: string
): Promise<readonly UnresolvedPlaceholder[]> {
  const files = await collectFiles(root);
  const problems: UnresolvedPlaceholder[] = [];

  for (const file of files) {
    if (!isTextFile(file)) continue;
    let stats;
    try {
      stats = await fs.stat(file);
    } catch (cause) {
      throw filesystemError('stat file', file, describeCause(cause));
    }
    if (stats.size > MAX_REPLACEABLE_FILE_BYTES) continue;

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(file);
    } catch (cause) {
      throw filesystemError('read file', file, cause);
    }
    if (looksBinary(buffer)) continue;

    const tokens = extractTokens(buffer.toString('utf8'));
    if (tokens.length > 0) {
      problems.push({ file: path.relative(root, file), placeholders: tokens });
    }
  }

  return problems;
}

export async function assertNoUnresolvedPlaceholders(root: string): Promise<void> {
  const problems = await findUnresolvedPlaceholders(root);
  if (problems.length === 0) return;

  const details = problems.slice(0, 10).map((problem) => {
    const joined = problem.placeholders.join(', ');
    return `${problem.file} -> ${joined}`;
  });
  if (problems.length > details.length) {
    details.push(`... and ${problems.length - details.length} more file(s)`);
  }

  throw templateError(
    'Scaffolding aborted: unresolved placeholders remain in the generated project.',
    details
  );
}
