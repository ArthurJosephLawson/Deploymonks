import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import {
  assertValidAuthorName,
  assertValidPort,
  assertValidProjectName,
  assertValidTargetDirectory,
  isValidPort,
  isValidProjectName,
  suggestTargetDirectory,
} from '../src/cli/validate.js';

test('accepts safe project names', () => {
  for (const name of ['app', 'my-service', 'my_service', 'Svc42', 'a']) {
    assert.equal(assertValidProjectName(name), name);
  }
  assert.equal(assertValidProjectName('  spaced-name  '), 'spaced-name');
});

test('rejects unsafe project names', () => {
  const invalid = [
    '',
    '   ',
    'has space',
    'dots.in.name',
    '..',
    '.',
    '../escape',
    'nested/path',
    'nested\\path',
    'quote"',
    'emoji-🎉',
    'a'.repeat(65),
    'CON',
  ];
  for (const name of invalid) {
    assert.equal(isValidProjectName(name), false, `expected "${name}" to be rejected`);
  }
});

test('validates ports', () => {
  assert.equal(assertValidPort('8080'), 8080);
  assert.equal(assertValidPort(1), 1);
  assert.equal(assertValidPort(65535), 65535);
  assert.equal(assertValidPort(3000), 3000);
});

test('rejects invalid ports', () => {
  for (const port of ['', '  ', '0', '-1', '65536', '3.5', 'abc', 'NaN', 'Infinity']) {
    assert.equal(isValidPort(port), false, `expected "${port}" to be rejected`);
  }
});

test('normalises the optional author name', () => {
  assert.equal(assertValidAuthorName('  Ada Lovelace  '), 'Ada Lovelace');
  assert.equal(assertValidAuthorName('   '), undefined);
  assert.equal(assertValidAuthorName(''), undefined);
});

test('resolves the target directory against the cwd', () => {
  const resolved = assertValidTargetDirectory('./somewhere');
  assert.ok(path.isAbsolute(resolved));
  assert.equal(resolved, path.resolve(process.cwd(), './somewhere'));
  assert.equal(suggestTargetDirectory('my-app'), './my-app');
});

test('rejects an empty target directory', () => {
  assert.throws(() => assertValidTargetDirectory('   '), /Target directory is required/);
});
