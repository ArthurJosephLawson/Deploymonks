import os from 'node:os';
import path from 'node:path';

import { userInputError } from '../core/errors.js';

export const PROJECT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
export const MAX_PROJECT_NAME_LENGTH = 64;
export const MIN_PORT = 1;
export const MAX_PORT = 65535;

const WINDOWS_RESERVED = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

export function assertValidProjectName(rawName: string): string {
  const name = rawName.trim();

  if (name === '') {
    throw userInputError('Project name is required.', 'Example: my-service');
  }
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    throw userInputError(
      `Project name is too long (${name.length} characters, max ${MAX_PROJECT_NAME_LENGTH}).`
    );
  }
  if (name === '.' || name === '..' || name.includes('..')) {
    throw userInputError(`Project name must not contain "..": ${rawName}`);
  }
  if (path.isAbsolute(name) || name.includes('/') || name.includes('\\')) {
    throw userInputError(
      `Project name must not contain path separators: ${rawName}`,
      'Pick a simple name and use --dir to choose the location.'
    );
  }
  if (!PROJECT_NAME_PATTERN.test(name)) {
    throw userInputError(
      `Invalid project name: ${rawName}`,
      'Only letters, digits, hyphens and underscores are allowed, and it must start with a letter or digit.'
    );
  }
  if (WINDOWS_RESERVED.has(name.toLowerCase())) {
    throw userInputError(`"${name}" is a reserved device name and cannot be used.`);
  }
  return name;
}

export function assertValidPort(rawPort: string | number): number {
  const value = typeof rawPort === 'number' ? rawPort : Number(String(rawPort).trim());

  if (rawPort === '' || (typeof rawPort === 'string' && rawPort.trim() === '')) {
    throw userInputError(
      'Port is required.',
      `Provide a number between ${MIN_PORT} and ${MAX_PORT}.`
    );
  }
  if (!Number.isInteger(value)) {
    throw userInputError(`Port must be a whole number, got: ${String(rawPort)}`);
  }
  if (value < MIN_PORT || value > MAX_PORT) {
    throw userInputError(
      `Port out of range: ${value}.`,
      `Valid ports are ${MIN_PORT} - ${MAX_PORT}.`
    );
  }
  return value;
}

export function assertValidAuthorName(rawAuthor: string): string | undefined {
  const author = rawAuthor.trim();
  if (author === '') return undefined;
  if (author.length > 120) {
    throw userInputError(`Author name is too long (${author.length} characters, max 120).`);
  }
  if (/[\r\n\t]/.test(author)) {
    throw userInputError('Author name must be a single line without tabs.');
  }
  return author;
}

export function assertValidTargetDirectory(rawTarget: string): string {
  const target = rawTarget.trim();
  if (target === '') {
    throw userInputError('Target directory is required.');
  }
  const resolved = path.resolve(process.cwd(), target);
  if (resolved === path.parse(resolved).root) {
    throw userInputError('The target directory cannot be the filesystem root.');
  }
  if (resolved === os.homedir()) {
    throw userInputError(
      `The target directory cannot be your home folder (${resolved}).`,
      'Use a dedicated sub-directory such as ./my-project.'
    );
  }
  return resolved;
}

export function isValidProjectName(rawName: string): boolean {
  try {
    assertValidProjectName(rawName);
    return true;
  } catch {
    return false;
  }
}

export function isValidPort(rawPort: string | number): boolean {
  try {
    assertValidPort(rawPort);
    return true;
  } catch {
    return false;
  }
}

export function suggestTargetDirectory(projectName: string): string {
  return `./${projectName.trim()}`;
}
