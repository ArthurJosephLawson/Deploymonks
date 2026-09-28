import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';

import { TEMPLATE_RENAMES } from './copyTemplates.js';
import { filesystemError, userInputError } from './errors.js';

export type OverwriteStrategy = 'abort' | 'merge' | 'replace';

export type TargetPreparation = {
  readonly targetDir: string;
  readonly created: boolean;
  readonly wasEmpty: boolean;
  readonly cleared: boolean;
  readonly preserved: readonly string[];
};

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw filesystemError('access path', target, cause);
  }
}

export async function statOrNull(target: string): Promise<fs.Stats | null> {
  try {
    return await fs.stat(target);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw filesystemError('stat path', target, cause);
  }
}

export async function readDirEntries(dir: string): Promise<readonly string[]> {
  try {
    const entries = await fs.readdir(dir);
    return [...entries].sort((a, b) => a.localeCompare(b, 'en'));
  } catch (cause) {
    throw filesystemError('read directory', dir, cause);
  }
}

export async function isEmptyDirectory(dir: string): Promise<boolean> {
  const entries = await readDirEntries(dir);
  return entries.length === 0;
}

export async function assertUsableTargetDirectory(targetDir: string): Promise<void> {
  const resolved = path.resolve(targetDir);
  const parent = path.dirname(resolved);
  const parsed = path.parse(resolved);

  if (resolved === parsed.root) {
    throw userInputError(`Refusing to use the filesystem root as a target: ${resolved}`);
  }
  if (resolved === os.homedir() || resolved === os.tmpdir()) {
    throw userInputError(
      `Refusing to scaffold directly into ${resolved}. Choose a dedicated sub-directory.`
    );
  }
  if (!(await pathExists(parent))) {
    throw userInputError(
      `The parent directory does not exist: ${parent}`,
      'Create it first, or choose a target directory one level up.'
    );
  }
  const stats = await statOrNull(resolved);
  if (stats !== null && !stats.isDirectory()) {
    throw userInputError(`The target path exists and is not a directory: ${resolved}`);
  }
}

export async function prepareTargetDirectory(
  targetDir: string,
  overwrite: OverwriteStrategy
): Promise<TargetPreparation> {
  await assertUsableTargetDirectory(targetDir);

  const resolved = path.resolve(targetDir);
  const existing = await statOrNull(resolved);
  const created = existing === null;
  const wasEmpty = created || (await isEmptyDirectory(resolved));
  let cleared = false;
  let preserved: readonly string[] = [];

  if (!created && !wasEmpty) {
    if (overwrite === 'abort') {
      const entries = await readDirEntries(resolved);
      throw userInputError(
        `Target directory is not empty: ${resolved}`,
        `It already contains ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}. ` +
          'Re-run with --overwrite merge (keep files) or --overwrite replace (wipe first).'
      );
    }
    if (overwrite === 'replace') {
      try {
        await fs.emptyDir(resolved);
        cleared = true;
      } catch (cause) {
        throw filesystemError('empty directory', resolved, cause);
      }
    } else {
      preserved = await readDirEntries(resolved);
    }
  }

  if (created) {
    try {
      await fs.ensureDir(resolved);
    } catch (cause) {
      throw filesystemError('create directory', resolved, cause);
    }
  }

  return { targetDir: resolved, created, wasEmpty, cleared, preserved };
}

export async function applyTemplateRenames(root: string): Promise<readonly string[]> {
  const renamed: string[] = [];
  for (const [from, to] of Object.entries(TEMPLATE_RENAMES)) {
    const source = path.join(root, from);
    const destination = path.join(root, to);
    if (!(await pathExists(source))) continue;
    try {
      await fs.move(source, destination, { overwrite: true });
      renamed.push(path.relative(root, destination));
    } catch (cause) {
      throw filesystemError('rename', source, cause);
    }
  }
  return renamed;
}

export async function countFiles(root: string): Promise<number> {
  const stats = await statOrNull(root);
  if (stats === null) return 0;
  if (stats.isFile()) return 1;
  if (!stats.isDirectory()) return 0;

  let total = 0;
  for (const entry of await readDirEntries(root)) {
    if (entry === 'node_modules' || entry === '.git' || entry === '__pycache__') continue;
    total += await countFiles(path.join(root, entry));
  }
  return total;
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  try {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, payload, 'utf8');
  } catch (cause) {
    throw filesystemError('write file', filePath, cause);
  }
}

export async function readTextFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (cause) {
    throw filesystemError('read file', filePath, cause);
  }
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  try {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf8');
  } catch (cause) {
    throw filesystemError('write file', filePath, cause);
  }
}
