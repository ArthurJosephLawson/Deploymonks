export type DeployMonkErrorKind = 'user-input' | 'filesystem' | 'template' | 'process' | 'runtime';

const EXIT_CODE_BY_KIND: Readonly<Record<DeployMonkErrorKind, number>> = {
  'user-input': 1,
  filesystem: 1,
  template: 1,
  process: 1,
  runtime: 1,
};

export class DeployMonkError extends Error {
  public readonly kind: DeployMonkErrorKind;
  public readonly details: readonly string[];
  public readonly hint: string | undefined;

  public constructor(
    kind: DeployMonkErrorKind,
    message: string,
    options: { details?: readonly string[]; hint?: string; cause?: unknown } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'DeployMonkError';
    this.kind = kind;
    this.details = options.details ?? [];
    this.hint = options.hint;
    Error.captureStackTrace?.(this, DeployMonkError);
  }

  public get exitCode(): number {
    return EXIT_CODE_BY_KIND[this.kind];
  }
}

export const userInputError = (message: string, hint?: string): DeployMonkError =>
  new DeployMonkError('user-input', message, hint === undefined ? {} : { hint });

export const filesystemError = (
  operation: string,
  target: string,
  cause: unknown
): DeployMonkError =>
  new DeployMonkError('filesystem', `Failed to ${operation}: ${target}`, {
    details: [describeCause(cause)],
    cause,
  });

export const templateError = (message: string, details: readonly string[] = []): DeployMonkError =>
  new DeployMonkError('template', message, { details });

export const processError = (
  message: string,
  details: readonly string[] = [],
  cause?: unknown
): DeployMonkError => new DeployMonkError('process', message, { details, cause });

export const runtimeError = (message: string, cause?: unknown): DeployMonkError =>
  new DeployMonkError('runtime', message, { cause });

export function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code;
    return code === undefined ? cause.message : `${cause.message} (${code})`;
  }
  if (typeof cause === 'string') return cause;
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}
