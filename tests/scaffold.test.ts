import assert from 'node:assert/strict';
import { test } from 'node:test';

import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

import { TEMPLATES, listTemplateIds } from '../src/core/copyTemplates.js';
import { DeployMonkError } from '../src/core/errors.js';
import { countFiles } from '../src/core/filesystem.js';
import { findUnresolvedPlaceholders } from '../src/core/placeholders.js';
import { generateProject, scaffoldProject, type ScaffoldOptions } from '../src/core/scaffold.js';

const withTempDir = async (run: (dir: string) => Promise<void>): Promise<void> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-scaffold-'));
  try {
    await run(dir);
  } finally {
    await fs.remove(dir);
  }
};

const baseOptions = (
  target: string,
  overrides: Partial<ScaffoldOptions> = {}
): ScaffoldOptions => ({
  projectName: 'Analytics Service',
  templateId: 'node-express',
  targetDir: target,
  authorName: 'Ada Lovelace',
  defaultPort: 4242,
  overwrite: 'abort',
  install: 'never',
  ...overrides,
});

const readTree = async (root: string): Promise<Map<string, string>> => {
  const files = new Map<string, string>();
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        files.set(path.relative(root, full), await fs.readFile(full, 'utf8'));
      }
    }
  };
  await walk(root);
  return files;
};

test('the registry exposes both templates', () => {
  assert.deepEqual([...listTemplateIds()], ['fastapi-tailwind', 'node-express']);
  assert.equal(TEMPLATES.length, 2);
  for (const template of TEMPLATES) {
    assert.ok(template.label.length > 0);
    assert.ok(template.nextSteps.length > 0);
  }
});

test('scaffolds the node-express template with every placeholder resolved', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'analytics-service');
    const result = await generateProject(baseOptions(target));

    assert.equal(result.targetDir, target);
    assert.ok(result.fileCount > 0);
    assert.deepEqual(await findUnresolvedPlaceholders(target), []);

    const manifest = await fs.readJson(path.join(target, '.deploymonk.json'));
    assert.equal(manifest.generator, 'deploymonk');
    assert.equal(manifest.template, 'node-express');
    assert.equal(manifest.defaultPort, 4242);

    const pkg = await fs.readJson(path.join(target, 'package.json'));
    assert.equal(pkg.name, 'analytics-service');
    assert.equal(pkg.author, 'Ada Lovelace');
    assert.equal(pkg.type, 'module');
    assert.equal(typeof pkg.scripts.test, 'string');

    const appSource = await fs.readFile(path.join(target, 'src', 'app.js'), 'utf8');
    assert.ok(!appSource.includes('{{'));

    const configSource = await fs.readFile(path.join(target, 'src', 'config', 'index.js'), 'utf8');
    assert.ok(configSource.includes('Analytics Service'));
    assert.ok(configSource.includes('Ada Lovelace'));
    assert.ok(!configSource.includes('{{'));

    assert.ok(await fs.pathExists(path.join(target, '.gitignore')));
    assert.equal(await fs.pathExists(path.join(target, '_gitignore')), false);
  });
});

test('scaffolds the fastapi-tailwind template with every placeholder resolved', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'analytics-service');
    const result = await generateProject(
      baseOptions(target, { templateId: 'fastapi-tailwind', defaultPort: 8000 })
    );

    assert.equal(result.template.id, 'fastapi-tailwind');
    assert.deepEqual(await findUnresolvedPlaceholders(target), []);

    const requirements = await fs.readFile(path.join(target, 'requirements.txt'), 'utf8');
    assert.ok(requirements.includes('fastapi'));
    assert.ok(!requirements.includes('{{'));

    const config = await fs.readFile(path.join(target, 'app', 'config.py'), 'utf8');
    assert.ok(config.includes('"Analytics Service"'));
    assert.ok(config.includes('"Ada Lovelace"'));
    assert.ok(config.includes('DEFAULT_PORT = 8000'));

    assert.ok(await fs.pathExists(path.join(target, 'run.py')));
    assert.ok(await fs.pathExists(path.join(target, 'tailwind.config.js')));
    assert.ok(await fs.pathExists(path.join(target, '.env.example')));
  });
});

test('the port placeholder is honoured by both templates', async () => {
  await withTempDir(async (dir) => {
    const nodeTarget = path.join(dir, 'node');
    const fastapiTarget = path.join(dir, 'fastapi');
    await generateProject(baseOptions(nodeTarget, { defaultPort: 9101 }));
    await generateProject(
      baseOptions(fastapiTarget, { templateId: 'fastapi-tailwind', defaultPort: 9202 })
    );

    const config = await fs.readFile(path.join(nodeTarget, 'src', 'config', 'index.js'), 'utf8');
    assert.ok(config.includes('9101'));

    const readme = await fs.readFile(path.join(fastapiTarget, 'README.md'), 'utf8');
    assert.ok(readme.includes('9202'));
  });
});

test('the author placeholder falls back when no author is given', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'no-author');
    const result = await generateProject(
      baseOptions(target, { authorName: undefined, projectName: 'no-author' })
    );
    assert.ok(result.values.authorName.length > 0);
    const pkg = await fs.readJson(path.join(target, 'package.json'));
    assert.equal(pkg.author, result.values.authorName);
  });
});

test('overwrite=abort refuses to touch a non-empty directory', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'occupied');
    await fs.outputFile(path.join(target, 'keep.txt'), 'precious', 'utf8');
    await assert.rejects(
      () => generateProject(baseOptions(target, { overwrite: 'abort' })),
      (error: unknown) => {
        assert.ok(error instanceof DeployMonkError);
        assert.equal(error.kind, 'user-input');
        assert.match(error.message, /not empty/);
        return true;
      }
    );
    assert.equal(await fs.readFile(path.join(target, 'keep.txt'), 'utf8'), 'precious');
  });
});

test('overwrite=merge keeps unrelated files', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'merged');
    await fs.outputFile(path.join(target, 'keep.txt'), 'precious', 'utf8');
    const result = await generateProject(baseOptions(target, { overwrite: 'merge' }));

    assert.equal(result.cleared, false);
    assert.deepEqual(result.preserved, ['keep.txt']);
    assert.equal(await fs.readFile(path.join(target, 'keep.txt'), 'utf8'), 'precious');
    assert.ok(await fs.pathExists(path.join(target, 'package.json')));
  });
});

test('overwrite=replace wipes the directory first', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'wiped');
    await fs.outputFile(path.join(target, 'stale.txt'), 'old', 'utf8');
    const result = await generateProject(baseOptions(target, { overwrite: 'replace' }));

    assert.equal(result.cleared, true);
    assert.equal(await fs.pathExists(path.join(target, 'stale.txt')), false);
    assert.ok(await fs.pathExists(path.join(target, 'package.json')));
  });
});

test('refuses dangerous target directories', async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, 'a-file');
    await fs.writeFile(file, 'not a directory', 'utf8');
    await assert.rejects(() => generateProject(baseOptions(file)), /not a directory/);
    await assert.rejects(
      () => generateProject(baseOptions(path.join(dir, 'missing', 'deep'))),
      /parent directory does not exist/
    );
    await assert.rejects(() => generateProject(baseOptions(os.tmpdir())), /Refusing to scaffold/);
  });
});

test('generation is reproducible: two runs produce byte identical trees', async () => {
  await withTempDir(async (dir) => {
    const first = path.join(dir, 'run-a');
    const second = path.join(dir, 'run-b');
    await generateProject(baseOptions(first));
    await generateProject(baseOptions(second));

    const a = await readTree(first);
    const b = await readTree(second);
    assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort());
    for (const [name, content] of a) {
      assert.equal(content, b.get(name), `content mismatch in ${name}`);
    }
    assert.ok(a.size > 5);
  });
});

test('scaffoldProject reports the install step without touching the network', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'with-install');
    const result = await scaffoldProject(baseOptions(target));
    assert.equal(result.installReport.outcomes.length, 1);
    assert.equal(result.installReport.outcomes[0]?.installed, false);
    assert.match(result.installReport.outcomes[0]?.message ?? '', /disabled/);
    assert.deepEqual(
      result.nextSteps,
      result.template.nextSteps.map((step) => step.replaceAll('{{DEFAULT_PORT}}', '4242'))
    );
    assert.ok(result.nextSteps.some((step) => step.includes('4242')));
    assert.equal(await countFiles(target), result.fileCount);
  });
});

test('the progress reporter sees every phase', async () => {
  await withTempDir(async (dir) => {
    const phases: string[] = [];
    await generateProject(
      baseOptions(path.join(dir, 'phases'), {
        onProgress: (phase) => phases.push(phase),
      })
    );
    assert.deepEqual(phases, ['prepare', 'copy', 'placeholders', 'manifest', 'verify']);
  });
});
