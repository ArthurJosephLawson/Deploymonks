import { spawn } from 'node:child_process';

import { describeCause, processError } from './errors.js';

const PROBE_TIMEOUT_MS = 5_000;

export type CommandStatus = {
  readonly command: string;
  readonly available: boolean;
  readonly version: string | null;
  readonly error: string | null;
};

export type RunCommandResult = {
  readonly command: string;
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
};

const firstLine = (value: string): string | null => {
  const line = value.split('\n').find((candidate) => candidate.trim() !== '');
  return line === undefined ? null : line.trim();
};

export function runCommand(
  command: string,
  args: readonly string[],
  options: { cwd: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }
): Promise<RunCommandResult> {
  const display = `${command} ${args.join(' ')}`.trim();
  return new Promise<RunCommandResult>((resolve) => {
    const startedAt = Date.now();
    let child;
    try {
      child = spawn(command, [...args], {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (cause) {
      resolve({
        command: display,
        code: -1,
        stdout: '',
        stderr: describeCause(cause),
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(
      () => {
        if (settled) return;
        child.kill('SIGTERM');
      },
      options.timeoutMs ?? 15 * 60_000
    );
    timer.unref?.();

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (cause) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command: display,
        code: -1,
        stdout,
        stderr: `${stderr}${describeCause(cause)}`.trim(),
        durationMs: Date.now() - startedAt,
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command: display,
        code: code ?? -1,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

export async function probeCommand(
  command: string,
  versionArgs: readonly string[] = ['--version']
): Promise<CommandStatus> {
  const result = await runCommand(command, versionArgs, {
    cwd: process.cwd(),
    timeoutMs: PROBE_TIMEOUT_MS,
  });
  if (result.code === 0) {
    return {
      command,
      available: true,
      version: firstLine(result.stdout) ?? firstLine(result.stderr),
      error: null,
    };
  }
  return {
    command,
    available: false,
    version: null,
    error: firstLine(result.stderr) ?? `exit code ${result.code}`,
  };
}

export type SystemReport = {
  readonly node: CommandStatus;
  readonly npm: CommandStatus;
  readonly python: CommandStatus;
  readonly pip: CommandStatus;
  readonly git: CommandStatus;
};

export async function collectSystemReport(): Promise<SystemReport> {
  const [node, npm, python, pip, git] = await Promise.all([
    probeCommand('node', ['--version']),
    probeCommand('npm', ['--version']),
    probeCommand('python3', ['--version']),
    probeCommand('pip3', ['--version']),
    probeCommand('git', ['--version']),
  ]);
  return { node, npm, python, pip, git };
}

export function commandFailure(
  result: RunCommandResult,
  hint: string
): ReturnType<typeof processError> {
  const details = [
    `command: ${result.command}`,
    `exit code: ${result.code}`,
    `duration: ${(result.durationMs / 1000).toFixed(1)}s`,
  ];
  const stderr = firstLine(result.stderr);
  const stdout = firstLine(result.stdout);
  if (stderr !== null) details.push(`stderr: ${stderr}`);
  if (stdout !== null) details.push(`stdout: ${stdout}`);
  return processError(`${hint}`, details);
}
