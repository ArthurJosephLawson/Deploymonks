import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EXIT_FAILURE,
  EXIT_SUCCESS,
  exitCodeFor,
  hasFinalized,
  renderError,
} from '../src/cli/exit.js';
import { HELP, parseArgs } from '../src/cli/index.js';
import { DeployMonkError, userInputError } from '../src/core/errors.js';

test('parses long and short value flags', () => {
  const flags = parseArgs([
    '--name',
    'demo',
    '-t',
    'node-express',
    '--dir=./out',
    '-a',
    'Ada',
    '--port',
    '8080',
  ]);
  assert.deepEqual(flags.invalid, []);
  assert.equal(flags.seed.projectName, 'demo');
  assert.equal(flags.seed.templateId, 'node-express');
  assert.equal(flags.seed.targetDir, './out');
  assert.equal(flags.seed.authorName, 'Ada');
  assert.equal(flags.seed.defaultPort, 8080);
});

test('parses boolean flags and their shorthands', () => {
  const flags = parseArgs(['--yes', '--dry-run', '--no-color', '--force', '--no-install']);
  assert.equal(flags.yes, true);
  assert.equal(flags.dryRun, true);
  assert.equal(flags.noColor, true);
  assert.equal(flags.seed.overwrite, 'replace');
  assert.equal(flags.seed.install, 'never');
});

test('flags win over their shorthands when both are present', () => {
  const flags = parseArgs(['--force', '--overwrite', 'merge']);
  assert.equal(flags.seed.overwrite, 'merge');
});

test('help, version and list are recognised', () => {
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['--version']).version, true);
  assert.equal(parseArgs(['--list']).list, true);
});

test('collects unknown and malformed arguments', () => {
  const flags = parseArgs(['--nope', '--name']);
  assert.deepEqual(flags.invalid, ['--nope', '--name (missing value)']);
});

test('an invalid port becomes NaN and is rejected downstream', () => {
  const flags = parseArgs(['--port', 'abc']);
  assert.ok(Number.isNaN(flags.seed.defaultPort as number));
});

test('the help text documents every supported flag', () => {
  for (const fragment of [
    '--name',
    '--template',
    '--dir',
    '--author',
    '--port',
    '--overwrite',
    '--install',
    '--yes',
    '--dry-run',
    '--list',
  ]) {
    assert.ok(HELP.includes(fragment), `help text is missing ${fragment}`);
  }
  assert.ok(HELP.includes('fastapi-tailwind'));
  assert.ok(HELP.includes('node-express'));
});

test('exit codes are 0 for success and 1 for every failure kind', () => {
  assert.equal(exitCodeFor(userInputError('bad')), 1);
  assert.equal(exitCodeFor(new DeployMonkError('filesystem', 'nope')), 1);
  assert.equal(exitCodeFor(new Error('boom')), 1);
  assert.equal(exitCodeFor('not even an error'), 1);
});

test('renderError never throws for unknown values', () => {
  renderError(new DeployMonkError('template', 'broken', { details: ['detail'], hint: 'fix it' }));
  renderError(new Error('plain'));
  renderError('a string');
});

test('the real exit code contract is covered by the smoke test', () => {
  assert.equal(EXIT_SUCCESS, 0);
  assert.equal(EXIT_FAILURE, 1);
  assert.equal(typeof hasFinalized, 'function');
});
