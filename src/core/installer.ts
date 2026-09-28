import path from 'node:path';

import fs from 'fs-extra';

import { getTemplate, type TemplateDefinition, type TemplateId } from './copyTemplates.js';
import { pathExists } from './filesystem.js';
import { commandFailure, probeCommand, runCommand } from './systemCheck.js';

export type InstallStrategy = 'always' | 'auto' | 'never';

export type InstallOutcome = {
  readonly manager: 'npm' | 'pip';
  readonly attempted: boolean;
  readonly installed: boolean;
  readonly command: string | null;
  readonly message: string;
  readonly error: string | null;
};

export type InstallReport = {
  readonly outcomes: readonly InstallOutcome[];
  readonly installed: boolean;
  readonly failed: boolean;
};

const NPM_ENV: NodeJS.ProcessEnv = {
  npm_config_audit: 'false',
  npm_config_fund: 'false',
  npm_config_update_notifier: 'false',
  npm_config_loglevel: 'error',
};

const PIP_ENV: NodeJS.ProcessEnv = {
  PIP_DISABLE_PIP_VERSION_CHECK: '1',
  PIP_NO_INPUT: '1',
  PYTHONUNBUFFERED: '1',
};

function mergeEnv(extra: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...process.env, ...extra };
}

async function installNodeDependencies(targetDir: string): Promise<InstallOutcome> {
  const npm = await probeCommand('npm', ['--version']);
  if (!npm.available) {
    return {
      manager: 'npm',
      attempted: false,
      installed: false,
      command: null,
      message: 'Skipped: `npm` is not available on this machine.',
      error: npm.error,
    };
  }

  const lockfile = path.join(targetDir, 'package-lock.json');
  const useCi = await pathExists(lockfile);
  const args = useCi ? ['ci', '--no-audit', '--no-fund'] : ['install', '--no-audit', '--no-fund'];
  const result = await runCommand('npm', args, {
    cwd: targetDir,
    env: mergeEnv(NPM_ENV),
  });

  if (result.code !== 0) {
    const failure = commandFailure(result, 'Dependency installation failed.');
    return {
      manager: 'npm',
      attempted: true,
      installed: false,
      command: result.command,
      message: failure.details.join(' | '),
      error: failure.details.join(' | '),
    };
  }

  return {
    manager: 'npm',
    attempted: true,
    installed: true,
    command: result.command,
    message: `Installed Node dependencies with \`${result.command}\`.`,
    error: null,
  };
}

const PEP668_MARKER = 'externally-managed-environment';

function venvPython(targetDir: string): string {
  return process.platform === 'win32'
    ? path.join(targetDir, '.venv', 'Scripts', 'python.exe')
    : path.join(targetDir, '.venv', 'bin', 'python');
}

const installIntoVenv = async (
  targetDir: string,
  python: string
): Promise<
  { readonly ok: true; readonly command: string } | { readonly ok: false; readonly log: string }
> => {
  const create = await runCommand(python, ['-m', 'venv', '.venv'], {
    cwd: targetDir,
    env: mergeEnv(PIP_ENV),
  });
  if (create.code !== 0) {
    return { ok: false, log: `${create.command} -> exit ${create.code}: ${create.stderr.trim()}` };
  }

  const venv = venvPython(targetDir);
  const install = await runCommand(venv, ['-m', 'pip', 'install', '-r', 'requirements.txt'], {
    cwd: targetDir,
    env: mergeEnv(PIP_ENV),
  });
  if (install.code !== 0) {
    return {
      ok: false,
      log: `${install.command} -> exit ${install.code}: ${install.stderr.trim()}`,
    };
  }

  return { ok: true, command: install.command };
};

async function installPythonDependencies(targetDir: string): Promise<InstallOutcome> {
  const requirements = path.join(targetDir, 'requirements.txt');
  if (!(await pathExists(requirements))) {
    return {
      manager: 'pip',
      attempted: false,
      installed: false,
      command: null,
      message: 'Skipped: no requirements.txt in the generated project.',
      error: null,
    };
  }

  const python = await probeCommand('python3', ['--version']);
  const candidates: ReadonlyArray<{ cmd: string; args: readonly string[] }> = python.available
    ? [{ cmd: 'python3', args: ['-m', 'pip', 'install', '-r', 'requirements.txt'] }]
    : [
        { cmd: 'pip3', args: ['install', '-r', 'requirements.txt'] },
        { cmd: 'pip', args: ['install', '-r', 'requirements.txt'] },
      ];

  const attempts: string[] = [];
  for (const candidate of candidates) {
    const result = await runCommand(candidate.cmd, candidate.args, {
      cwd: targetDir,
      env: mergeEnv(PIP_ENV),
    });
    if (result.code === 0) {
      return {
        manager: 'pip',
        attempted: true,
        installed: true,
        command: result.command,
        message: `Installed Python dependencies with \`${result.command}\`.`,
        error: null,
      };
    }

    if (python.available && result.stderr.includes(PEP668_MARKER)) {
      const venvResult = await installIntoVenv(targetDir, 'python3');
      if (venvResult.ok) {
        return {
          manager: 'pip',
          attempted: true,
          installed: true,
          command: venvResult.command,
          message: `Installed Python dependencies into .venv with \`${venvResult.command}\`. Activate it with \`source .venv/bin/activate\` (Windows: \`.venv\\Scripts\\activate\`).`,
          error: null,
        };
      }
      attempts.push(`venv fallback -> ${venvResult.log}`);
    }

    attempts.push(
      `${result.command} -> exit ${result.code}: ${result.stderr.trim() || 'no output'}`
    );
  }

  return {
    manager: 'pip',
    attempted: attempts.length > 0,
    installed: false,
    command: null,
    message: 'Skipped: no working Python package manager was found on this machine.',
    error: attempts.join(' | '),
  };
}

export async function installDependencies(options: {
  readonly template: TemplateDefinition;
  readonly targetDir: string;
  readonly strategy: InstallStrategy;
}): Promise<InstallReport> {
  if (options.strategy === 'never') {
    return {
      outcomes: [
        {
          manager: options.template.packageManager,
          attempted: false,
          installed: false,
          command: null,
          message: 'Dependency installation disabled (--no-install).',
          error: null,
        },
      ],
      installed: false,
      failed: false,
    };
  }

  const outcome =
    options.template.packageManager === 'npm'
      ? await installNodeDependencies(options.targetDir)
      : await installPythonDependencies(options.targetDir);

  return {
    outcomes: [outcome],
    installed: outcome.installed,
    failed: outcome.attempted && !outcome.installed,
  };
}

export async function installForTemplate(
  templateId: TemplateId,
  targetDir: string,
  strategy: InstallStrategy
): Promise<InstallReport> {
  const template = getTemplate(templateId);
  await fs.ensureDir(targetDir);
  return installDependencies({ template, targetDir, strategy });
}
