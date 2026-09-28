import assert from 'node:assert/strict';
import { test } from 'node:test';

import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

import {
  MAX_REPLACEABLE_FILE_BYTES,
  assertNoUnresolvedPlaceholders,
  extractTokens,
  findUnresolvedPlaceholders,
  isTextFile,
  looksBinary,
  replaceInFile,
  replaceInString,
  replacePlaceholdersInTree,
} from '../src/core/placeholders.js';
import { buildReplacements, resolveProjectValues } from '../src/core/scaffold.js';

const makeValues = () =>
  resolveProjectValues({
    projectName: 'My Service',
    authorName: 'Ada Lovelace',
    defaultPort: 4242,
    year: 2026,
  });

test('replaceInString swaps every known placeholder and leaves the rest alone', () => {
  const replacements = buildReplacements(makeValues());
  const input = 'name={{PROJECT_NAME}} port={{DEFAULT_PORT}} author={{AUTHOR_NAME}}';
  const output = replaceInString(input, replacements);
  assert.equal(output, 'name=My Service port=4242 author=Ada Lovelace');
});

test('replaceInString tolerates whitespace inside the token', () => {
  const replacements = buildReplacements(makeValues());
  assert.equal(replaceInString('{{  PROJECT_NAME  }}', replacements), 'My Service');
});

test('replaceInString never treats replacement values as patterns', () => {
  const replacements = new Map([['PROJECT_NAME', '$& $1 $$literal']]);
  assert.equal(replaceInString('{{PROJECT_NAME}}', replacements), '$& $1 $$literal');
});

test('replaceInString leaves unknown tokens untouched', () => {
  assert.equal(
    replaceInString('{{NOT_A_PLACEHOLDER}}', buildReplacements(makeValues())),
    '{{NOT_A_PLACEHOLDER}}'
  );
});

test('resolveProjectValues derives stable, npm safe values', () => {
  const values = makeValues();
  assert.equal(values.projectName, 'My Service');
  assert.equal(values.packageName, 'my-service');
  assert.equal(values.projectSlug, 'my-service');
  assert.equal(values.authorName, 'Ada Lovelace');
  assert.equal(values.defaultPort, 4242);
});

test('toPackageName sanitises hostile names', () => {
  const values = resolveProjectValues({ projectName: '  Weird__Name!!  ', defaultPort: 1 });
  assert.equal(values.packageName, 'weird__name');
  assert.equal(values.projectSlug, 'weird-name');
});

test('extractTokens finds any moustache construct', () => {
  assert.deepEqual(extractTokens('a {{x}} b {{ y }} c'), ['{{x}}', '{{ y }}']);
  assert.deepEqual(extractTokens('nothing here'), []);
});

test('isTextFile classifies by extension and by well known file names', () => {
  assert.equal(isTextFile('a/b/main.py'), true);
  assert.equal(isTextFile('a/b/package.json'), true);
  assert.equal(isTextFile('a/b/README.md'), true);
  assert.equal(isTextFile('a/b/_gitignore'), true);
  assert.equal(isTextFile('a/b/Dockerfile'), true);
  assert.equal(isTextFile('a/b/image.png'), false);
  assert.equal(isTextFile('a/b/archive.zip'), false);
  assert.equal(isTextFile('a/b/noextension'), false);
});

test('looksBinary sniffs NUL bytes', () => {
  assert.equal(looksBinary(Buffer.from('plain text')), false);
  assert.equal(looksBinary(Buffer.from([0x50, 0x4b, 0x00, 0x03])), true);
});

test('replaceInFile rewrites text and ignores binaries', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-placeholders-'));
  try {
    const textFile = path.join(dir, 'notes.md');
    await fs.writeFile(textFile, 'Project: {{PROJECT_NAME}} on {{DEFAULT_PORT}}', 'utf8');
    const binaryFile = path.join(dir, 'logo.png');
    await fs.writeFile(binaryFile, Buffer.from([0x89, 0x50, 0x00, 0x0d]));
    const replacements = buildReplacements(makeValues());
    assert.equal(await replaceInFile(textFile, replacements), true);
    assert.equal(await replaceInFile(textFile, replacements), false, 'idempotent second pass');
    assert.equal(await replaceInFile(binaryFile, replacements), false);
    assert.equal(await fs.readFile(textFile, 'utf8'), 'Project: My Service on 4242');
  } finally {
    await fs.remove(dir);
  }
});

test('replacePlaceholdersInTree walks nested folders deterministically', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-tree-'));
  try {
    await fs.outputFile(path.join(dir, 'package.json'), '{"name":"{{PACKAGE_NAME}}"}', 'utf8');
    await fs.outputFile(path.join(dir, 'src', 'app.js'), '// {{PROJECT_NAME}}', 'utf8');
    await fs.outputFile(
      path.join(dir, 'README.md'),
      '# {{PROJECT_NAME}} ({{DEFAULT_PORT}})',
      'utf8'
    );
    await fs.outputFile(path.join(dir, 'assets', 'icon.bin'), Buffer.from([0x00, 0x01]));
    const result = await replacePlaceholdersInTree(dir, buildReplacements(makeValues()));
    assert.equal(result.scannedFiles, 4);
    assert.equal(result.modifiedFiles.length, 3);
    assert.equal(result.skippedFiles.length, 1);
    assert.deepEqual(
      result.modifiedFiles.map((file) => path.relative(dir, file)),
      ['package.json', 'README.md', 'src/app.js']
    );
    assert.equal(
      await fs.readFile(path.join(dir, 'package.json'), 'utf8'),
      '{"name":"my-service"}'
    );
    assert.equal(await fs.readFile(path.join(dir, 'src', 'app.js'), 'utf8'), '// My Service');
  } finally {
    await fs.remove(dir);
  }
});

test('the leftover scan reports and then rejects unresolved placeholders', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-leftover-'));
  try {
    await fs.outputFile(path.join(dir, 'ok.txt'), 'nothing to see', 'utf8');
    assert.deepEqual(await findUnresolvedPlaceholders(dir), []);
    await assertNoUnresolvedPlaceholders(dir);
    await fs.outputFile(path.join(dir, 'broken.py'), 'X = "{{MYSTERY_VALUE}}"', 'utf8');
    const problems = await findUnresolvedPlaceholders(dir);
    assert.equal(problems.length, 1);
    assert.deepEqual(problems[0]?.placeholders, ['{{MYSTERY_VALUE}}']);
    await assert.rejects(
      () => assertNoUnresolvedPlaceholders(dir),
      /unresolved placeholders remain/
    );
  } finally {
    await fs.remove(dir);
  }
});

test('oversized files are skipped instead of being rewritten', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-large-'));
  try {
    const big = path.join(dir, 'big.txt');
    await fs.writeFile(big, 'x'.repeat(MAX_REPLACEABLE_FILE_BYTES + 10), 'utf8');
    const result = await replacePlaceholdersInTree(dir, buildReplacements(makeValues()));
    assert.equal(result.modifiedFiles.length, 0);
  } finally {
    await fs.remove(dir);
  }
});
