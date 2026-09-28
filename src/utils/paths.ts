import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function getPackageRoot(): string {
  let current = moduleDir;
  for (let depth = 0; depth < 10; depth += 1) {
    if (existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('Unable to locate the deploymonk package root (no package.json found).');
}

export function getTemplatesRoot(): string {
  return path.join(getPackageRoot(), 'src', 'templates');
}

export function toPosix(target: string): string {
  return target.split(path.sep).join('/');
}

export function resolveFromCwd(target: string): string {
  return path.resolve(process.cwd(), target);
}

export function displayPath(target: string): string {
  const relative = path.relative(process.cwd(), target);
  if (relative === '') return '.';
  if (relative.startsWith('..')) return target;
  return toPosix(relative);
}

export function isPathInside(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  if (relative === '') return true;
  if (relative.startsWith('..')) return false;
  return !path.isAbsolute(relative);
}
