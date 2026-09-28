import chalk from 'chalk';

const isColorDisabled = (): boolean => {
  const env = process.env;
  if (env['NO_COLOR'] !== undefined && env['NO_COLOR'] !== '') return true;
  if (env['FORCE_COLOR'] === '0') return true;
  if (env['TERM'] === 'dumb') return true;
  return !process.stdout.isTTY;
};

let colorEnabled = isColorDisabled() === false;

export function setColorEnabled(enabled: boolean): void {
  colorEnabled = enabled;
  chalk.level = enabled ? 1 : 0;
}

export function isColorEnabled(): boolean {
  return colorEnabled;
}

const paint = (text: string, apply: (value: string) => string): string =>
  colorEnabled ? apply(text) : text;

export const color = {
  bold: (text: string): string => paint(text, (value) => chalk.bold(value)),
  dim: (text: string): string => paint(text, (value) => chalk.dim(value)),
  cyan: (text: string): string => paint(text, (value) => chalk.cyan(value)),
  green: (text: string): string => paint(text, (value) => chalk.green(value)),
  yellow: (text: string): string => paint(text, (value) => chalk.yellow(value)),
  red: (text: string): string => paint(text, (value) => chalk.red(value)),
  blue: (text: string): string => paint(text, (value) => chalk.blue(value)),
  magenta: (text: string): string => paint(text, (value) => chalk.magenta(value)),
  gray: (text: string): string => paint(text, (value) => chalk.gray(value)),
};

export const SYMBOLS = {
  success: '✔',
  failure: '✖',
  warning: '⚠',
  info: 'ℹ',
  step: '›',
  bullet: '•',
} as const;

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const err = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

export const log = {
  raw(line = ''): void {
    out(line);
  },
  info(message: string): void {
    out(`${color.blue(SYMBOLS.info)} ${message}`);
  },
  step(message: string): void {
    out(`${color.cyan(SYMBOLS.step)} ${message}`);
  },
  success(message: string): void {
    out(`${color.green(SYMBOLS.success)} ${message}`);
  },
  warn(message: string): void {
    err(`${color.yellow(SYMBOLS.warning)} ${message}`);
  },
  error(message: string): void {
    err(`${color.red(SYMBOLS.failure)} ${message}`);
  },
  debug(message: string): void {
    if (process.env['DEPLOYMONK_DEBUG'] === '1') {
      err(color.gray(`[debug] ${message}`));
    }
  },
  blank(): void {
    out('');
  },
};

const BANNER_LINES = [
  '  ____                 __        __  __           _       ',
  ' |  _ \\  ___  ___  _  | |      |  \\/  | ___  _ __| |_ ___ ',
  " | | | |/ _ \\/ _ \\/ _` | | _____| |\\/| |/ _ \\| '__| __/ __|",
  ' | |_| |  __/ (_) | (_| | |/ _ \\| |  | | (_) | |  | || (__ ',
  ' |____/ \\___|\\___/ \\__,_|_/_/ \\_\\_|  |_|\\___/|_|  \\__\\___|',
] as const;

const TAGLINE = 'Scaffolding full-stack projects, one monk at a time.';

export function printBanner(version: string): void {
  log.blank();
  for (const line of BANNER_LINES) {
    out(color.cyan(line));
  }
  out(`${color.gray(TAGLINE)} ${color.gray(`v${version}`)}`);
  log.blank();
}

export function printKeyValue(pairs: ReadonlyArray<readonly [string, string]>): void {
  if (pairs.length === 0) return;
  const width = pairs.reduce((max, [key]) => Math.max(max, key.length), 0);
  for (const [key, value] of pairs) {
    out(`  ${color.gray(`${key.padEnd(width)}`)}  ${value}`);
  }
}
