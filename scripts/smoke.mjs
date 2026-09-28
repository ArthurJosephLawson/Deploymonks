#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'deploymonk.cjs');
const compiledEntry = path.join(root, 'dist', 'cli', 'index.js');

const run = (command, args, options = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (code) =>
      resolve({ code: code ?? -1, stdout, stderr, output: stdout + stderr })
    );
  });

const cli = (args, options = {}) =>
  run(process.execPath, [bin, ...args], { env: { NO_COLOR: '1' }, ...options });

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

const collectPlaceholders = async (dir) => {
  const found = [];
  const walk = async (current) => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      const stats = await fs.stat(full);
      if (stats.size > 2 * 1024 * 1024) continue;
      const content = await fs.readFile(full, 'utf8');
      const matches = content.match(/\{\{[^}\n]*\}\}/g);
      if (matches !== null) {
        found.push(`${path.relative(dir, full)} -> ${[...new Set(matches)].join(', ')}`);
      }
    }
  };
  await walk(dir);
  return found;
};

const exists = (...segments) => fs.existsSync(path.join(...segments));

const main = async () => {
  if (!exists(compiledEntry)) {
    console.error('dist/cli/index.js is missing. Run `npm run build` first.');
    process.exitCode = 1;
    return;
  }

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-smoke-'));
  console.log(`smoke workspace: ${workspace}\n`);
  const nodeTarget = path.join(workspace, 'smoke-node');

  const fastapiTarget = path.join(workspace, 'smoke-fastapi');
  const help = await cli(['--help']);
  const version = await cli(['--version']);
  const list = await cli(['--list']);
  const dryRun = await cli([
    '--name',
    'smoke-dry',
    '--template',
    'node-express',
    '--dir',
    path.join(workspace, 'dry'),
    '--dry-run',
    '--no-install',
  ]);
  const badName = await cli(['--name', 'bad name', '--yes']);
  const badTemplate = await cli(['--name', 'ok-name', '--template', 'nope', '--yes']);
  const badPort = await cli(['--name', 'ok-name', '--port', '70000', '--yes']);
  const badFlag = await cli(['--totally-unknown']);
  const nodeRun = await cli([
    '--name',
    'smoke-node',
    '--template',
    'node-express',
    '--dir',
    nodeTarget,
    '--port',
    '4567',
    '--author',
    'Smoke Monk',
    '--no-install',
    '--yes',
  ]);
  const fastapiRun = await cli([
    '--name',
    'smoke-fastapi',
    '--template',
    'fastapi-tailwind',
    '--dir',
    fastapiTarget,
    '--port',
    '8123',
    '--no-install',
    '--yes',
  ]);
  const nodePackage = exists(nodeTarget, 'package.json')
    ? fs.readJsonSync(path.join(nodeTarget, 'package.json'))
    : null;
  const nodeConfigSource = exists(nodeTarget, 'src', 'config', 'index.js')
    ? fs.readFileSync(path.join(nodeTarget, 'src', 'config', 'index.js'), 'utf8')
    : '';
  const reRun = await cli([
    '--name',
    'smoke-node',
    '--template',
    'node-express',
    '--dir',
    nodeTarget,
    '--no-install',
    '--yes',
  ]);
  const forced = await cli([
    '--name',
    'smoke-node',
    '--template',
    'node-express',
    '--dir',
    nodeTarget,
    '--no-install',
    '--force',
    '--yes',
  ]);
  const nodePlaceholders = exists(nodeTarget)
    ? await collectPlaceholders(nodeTarget)
    : ['missing tree'];

  const fastapiPlaceholders = exists(fastapiTarget)
    ? await collectPlaceholders(fastapiTarget)
    : ['missing tree'];
  const npmInstall = await run('npm', ['install', '--no-audit', '--no-fund', '--silent'], {
    cwd: nodeTarget,
    env: { npm_config_loglevel: 'error' },
  });
  const nodeTests = await run('npm', ['test', '--silent'], { cwd: nodeTarget });

  check('bin/deploymonk.cjs is executable', () => {
    if (process.platform === 'win32') return true;
    return (fs.statSync(bin).mode & 0o111) !== 0;
  });
  check('deploymonk --help exits 0 and prints usage', () => {
    if (help.code !== 0) console.error(help.output);
    return help.code === 0 && help.stdout.includes('Usage');
  });
  check('deploymonk --version exits 0 with a semver string', () => {
    return version.code === 0 && /^\d+\.\d+\.\d+/.test(version.stdout.trim());
  });
  check('deploymonk --list exits 0 and shows both templates', () => {
    return (
      list.code === 0 &&
      list.stdout.includes('fastapi-tailwind') &&
      list.stdout.includes('node-express')
    );
  });
  check('--dry-run exits 0 without writing to disk', () => {
    return dryRun.code === 0 && !exists(workspace, 'dry');
  });
  check('an invalid project name exits 1', () => {
    return badName.code === 1 && /Invalid project name/.test(badName.output);
  });
  check('an unknown template exits 1', () => {
    return badTemplate.code === 1 && /Unknown template/.test(badTemplate.output);
  });
  check('an out-of-range port exits 1', () => {
    return badPort.code === 1 && /out of range/i.test(badPort.output);
  });
  check('an unknown flag exits 1', () => {
    return badFlag.code === 1 && /Unrecognised/.test(badFlag.output);
  });
  check('scaffolding node-express exits 0', () => {
    if (nodeRun.code !== 0) console.error(nodeRun.output);
    return nodeRun.code === 0;
  });
  check('the node-express tree is complete and runnable', () => {
    return (
      exists(nodeTarget, 'package.json') &&
      exists(nodeTarget, 'src', 'app.js') &&
      exists(nodeTarget, 'src', 'index.js') &&
      exists(nodeTarget, 'src', 'routes', 'index.js') &&
      exists(nodeTarget, 'tests', 'health.test.js') &&
      exists(nodeTarget, '.gitignore') &&
      exists(nodeTarget, '.deploymonk.json')
    );
  });
  check('the node-express package.json is valid and substituted', () => {
    return (
      nodePackage !== null &&
      nodePackage.name === 'smoke-node' &&
      nodePackage.author === 'Smoke Monk' &&
      nodePackage.type === 'module'
    );
  });
  check('the node-express config uses the requested port', () => {
    return nodeConfigSource.includes('4567');
  });
  check('no unresolved placeholders in the node-express project', () => {
    if (nodePlaceholders.length > 0) console.error(nodePlaceholders.join('\n'));
    return nodePlaceholders.length === 0;
  });
  check('scaffolding fastapi-tailwind exits 0', () => {
    if (fastapiRun.code !== 0) console.error(fastapiRun.output);
    return fastapiRun.code === 0;
  });
  check('the fastapi-tailwind tree is complete', () => {
    return (
      exists(fastapiTarget, 'requirements.txt') &&
      exists(fastapiTarget, 'app', 'main.py') &&
      exists(fastapiTarget, 'app', 'routers', 'health.py') &&
      exists(fastapiTarget, 'app', 'static', 'css', 'input.css') &&
      exists(fastapiTarget, 'run.py') &&
      exists(fastapiTarget, 'tailwind.config.js') &&
      exists(fastapiTarget, '.gitignore')
    );
  });
  check('no unresolved placeholders in the fastapi-tailwind project', () => {
    if (fastapiPlaceholders.length > 0) console.error(fastapiPlaceholders.join('\n'));
    return fastapiPlaceholders.length === 0;
  });
  check('re-scaffolding a non-empty directory without --overwrite exits 1', () => {
    return reRun.code === 1 && /not empty/.test(reRun.output);
  });
  check('--force succeeds on the same directory', () => {
    return forced.code === 0;
  });
  check('npm install succeeds inside the generated node project', () => {
    if (npmInstall.code !== 0) console.error(npmInstall.output);
    return npmInstall.code === 0;
  });
  check('the generated node project test suite passes', () => {
    if (nodeTests.code !== 0) console.error(nodeTests.output);
    return nodeTests.code === 0;
  });

  let failures = 0;
  for (const { name, fn } of checks) {
    try {
      const outcome = await fn();
      if (outcome === true) {
        console.log(`  ok    ${name}`);
      } else {
        failures += 1;
        console.error(`  FAIL  ${name}`);
      }
    } catch (error) {
      failures += 1;
      console.error(`  FAIL  ${name} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await fs.remove(workspace);

  console.log('');
  if (failures > 0) {
    console.error(`smoke: ${failures}/${checks.length} check(s) failed`);
    process.exitCode = 1;
  } else {
    console.log(`smoke: all ${checks.length} checks passed`);
  }
};

await main();
