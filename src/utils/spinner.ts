import ora, { type Ora } from 'ora';

import { color, log } from './log.js';

export type SpinnerStatus = 'succeed' | 'fail' | 'warn' | 'info';

export interface DeployMonkSpinner {
  readonly text: string;
  start(text?: string): DeployMonkSpinner;
  succeed(text?: string): void;
  fail(text?: string): void;
  warn(text?: string): void;
  info(text?: string): void;
  stop(): void;
}

const plainLine = (symbol: string, message: string): void => {
  log.raw(`  ${symbol} ${message}`);
};

const createPlainSpinner = (initialText: string): DeployMonkSpinner => {
  let text = initialText;
  return {
    get text(): string {
      return text;
    },
    start(nextText?: string): DeployMonkSpinner {
      if (typeof nextText === 'string') text = nextText;
      return this;
    },
    succeed(nextText?: string): void {
      if (typeof nextText === 'string') text = nextText;
      plainLine(color.green('✔'), text);
    },
    fail(nextText?: string): void {
      if (typeof nextText === 'string') text = nextText;
      plainLine(color.red('✖'), text);
    },
    warn(nextText?: string): void {
      if (typeof nextText === 'string') text = nextText;
      plainLine(color.yellow('⚠'), text);
    },
    info(nextText?: string): void {
      if (typeof nextText === 'string') text = nextText;
      plainLine(color.blue('ℹ'), text);
    },
    stop(): void {},
  };
};

const wrap = (spinner: Ora, fallbackText: string): DeployMonkSpinner => ({
  get text(): string {
    return spinner.text;
  },
  start(text?: string): DeployMonkSpinner {
    const next = typeof text === 'string' ? text : fallbackText;
    spinner.start(next);
    return this;
  },
  succeed(text?: string): void {
    spinner.succeed(typeof text === 'string' ? text : spinner.text);
  },
  fail(text?: string): void {
    spinner.fail(typeof text === 'string' ? text : spinner.text);
  },
  warn(text?: string): void {
    spinner.warn(typeof text === 'string' ? text : spinner.text);
  },
  info(text?: string): void {
    spinner.info(typeof text === 'string' ? text : spinner.text);
  },
  stop(): void {
    if (spinner.isSpinning) spinner.stop();
  },
});

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function createSpinner(initialText: string): DeployMonkSpinner {
  if (!process.stderr.isTTY) {
    return createPlainSpinner(initialText);
  }
  return wrap(ora({ stream: process.stderr, discardStdin: false }).start(initialText), initialText);
}

export async function withSpinner<T>(
  text: string,
  task: (spinner: DeployMonkSpinner) => Promise<T>,
  successText: (result: T) => string = () => text
): Promise<T> {
  const spinner = createSpinner(text);
  try {
    const result = await task(spinner);
    spinner.succeed(successText(result));
    return result;
  } catch (error) {
    spinner.fail(text);
    throw error;
  }
}
