import { DeployMonkError, describeCause } from '../core/errors.js';
import { color, log } from '../utils/log.js';

export const EXIT_SUCCESS = 0;
export const EXIT_FAILURE = 1;

let finalized = false;

const showStacks = (): boolean => process.env['DEPLOYMONK_DEBUG'] === '1';

export function exitCodeFor(error: unknown): number {
  return error instanceof DeployMonkError ? error.exitCode : EXIT_FAILURE;
}

export function renderError(error: unknown): void {
  if (error instanceof DeployMonkError) {
    log.error(error.message);
    for (const detail of error.details) {
      log.raw(`    ${color.gray(detail)}`);
    }
    if (error.hint !== undefined) {
      log.blank();
      log.raw(`  ${color.yellow('hint')} ${error.hint}`);
    }
    if (showStacks() && error.stack !== undefined) {
      log.raw(color.gray(error.stack));
    }
    return;
  }

  log.error(`Unexpected error: ${describeCause(error)}`);
  if (showStacks() && error instanceof Error && error.stack !== undefined) {
    log.raw(color.gray(error.stack));
  }
}

export function finalize(code: number): void {
  process.exitCode = code;
  finalized = true;
}

export function hasFinalized(): boolean {
  return finalized;
}

export function exitSuccessfully(): void {
  finalize(EXIT_SUCCESS);
}

export function exitWithError(error: unknown, code: number = exitCodeFor(error)): void {
  renderError(error);
  finalize(code);
}
