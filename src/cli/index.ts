import {
  DEFAULT_TEMPLATE_ID,
  TEMPLATES,
  getTemplate,
  isTemplateId,
  listTemplateIds,
  type TemplateId,
} from '../core/copyTemplates.js';
import { DeployMonkError, userInputError } from '../core/errors.js';
import type { OverwriteStrategy } from '../core/filesystem.js';
import type { InstallStrategy } from '../core/installer.js';
import {
  DEPLOYMONK_VERSION,
  scaffoldProject,
  type ProgressReporter,
  type ScaffoldResult,
} from '../core/scaffold.js';
import { color, log, printBanner, printKeyValue, setColorEnabled } from '../utils/log.js';
import { displayPath } from '../utils/paths.js';
import { createSpinner, isInteractive, type DeployMonkSpinner } from '../utils/spinner.js';
import { exitSuccessfully, exitWithError } from './exit.js';
import { runPromptFlow, type PromptAnswers, type PromptSeed } from './promptFlow.js';
import {
  assertValidAuthorName,
  assertValidPort,
  assertValidProjectName,
  assertValidTargetDirectory,
  suggestTargetDirectory,
} from './validate.js';

type CliFlags = {
  readonly help: boolean;
  readonly version: boolean;
  readonly list: boolean;
  readonly yes: boolean;
  readonly dryRun: boolean;
  readonly debug: boolean;
  readonly noColor: boolean;
  readonly seed: PromptSeed;
  readonly invalid: readonly string[];
};

const HELP_TEXT = `deploymonk - scaffold full-stack project boilerplates

Usage
  deploymonk                       Start the interactive scaffolder
  deploymonk --list                List the bundled templates
  deploymonk -n my-api -t node-express -d ./out --yes

Options
  -n, --name <name>            Project name (letters, digits, "-", "_")
  -t, --template <id>         ${listTemplateIds().join(' | ')}
  -d, --dir <path>             Target directory (default: ./<project-name>)
  -a, --author <name>          Author name written into the project
  -p, --port <number>          Default port (1-65535)
      --overwrite <mode>       abort | merge | replace  (default: abort)
      --force                  Shorthand for --overwrite replace
      --install <mode>         always | auto | never   (default: auto)
      --no-install             Shorthand for --install never
  -y, --yes                    Non-interactive run (requires --name)
      --dry-run                Print the plan without writing anything
      --list                   List the bundled templates
  -h, --help                   Show this help
  -v, --version                Show the version
      --no-color               Disable coloured output
      --debug                  Print stack traces

Exit codes
  0  success
  1  invalid input or a failed operation
`;

const VALUE_FLAGS: Readonly<Record<string, keyof PromptSeed>> = {
  '--name': 'projectName',
  '-n': 'projectName',
  '--template': 'templateId',
  '-t': 'templateId',
  '--dir': 'targetDir',
  '-d': 'targetDir',
  '--author': 'authorName',
  '-a': 'authorName',
  '--port': 'defaultPort',
  '-p': 'defaultPort',
  '--overwrite': 'overwrite',
  '--install': 'install',
};

export function parseArgs(argv: readonly string[]): CliFlags {
  const seed: Record<string, string | number> = {};
  const invalid: string[] = [];
  let help = false;
  let version = false;
  let list = false;
  let yes = false;
  let dryRun = false;
  let debug = false;
  let noColor = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;

    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--version' || arg === '-v') {
      version = true;
      continue;
    }
    if (arg === '--list') {
      list = true;
      continue;
    }
    if (arg === '--yes' || arg === '-y') {
      yes = true;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--debug') {
      debug = true;
      continue;
    }
    if (arg === '--no-color') {
      noColor = true;
      continue;
    }
    if (arg === '--force') {
      seed['overwrite'] = 'replace';
      continue;
    }
    if (arg === '--no-install') {
      seed['install'] = 'never';
      continue;
    }

    const equalsIndex = arg.indexOf('=');
    const flagName = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    const key = VALUE_FLAGS[flagName];

    if (key === undefined) {
      invalid.push(arg);
      continue;
    }

    let rawValue: string | undefined;
    if (equalsIndex !== -1) {
      rawValue = arg.slice(equalsIndex + 1);
    } else {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('-')) {
        invalid.push(`${flagName} (missing value)`);
        continue;
      }
      rawValue = next;
      index += 1;
    }

    if (rawValue === '') {
      invalid.push(`${flagName} (empty value)`);
      continue;
    }

    seed[key] = key === 'defaultPort' ? Number(rawValue) : rawValue;
  }

  return {
    help,
    version,
    list,
    yes,
    dryRun,
    debug,
    noColor,
    seed: seed as PromptSeed,
    invalid,
  };
}

function assertNoUnknownFlags(flags: CliFlags): void {
  if (flags.invalid.length === 0) return;
  throw userInputError(
    `Unrecognised or malformed argument${flags.invalid.length === 1 ? '' : 's'}: ${flags.invalid.join(', ')}`,
    'Run `deploymonk --help` to see the supported options.'
  );
}

function printTemplateList(): void {
  log.blank();
  log.raw(`  ${color.bold('Available templates')}`);
  for (const template of TEMPLATES) {
    log.blank();
    log.raw(`  ${color.cyan(template.id)} ${color.gray(`(${template.label})`)}`);
    log.raw(`    ${template.description}`);
    log.raw(`    ${color.gray(`stack: ${template.stack.join(', ')}`)}`);
    log.raw(`    ${color.gray(`default port: ${template.defaultPort}`)}`);
  }
  log.blank();
}

function isCancellation(error: unknown): boolean {
  return error instanceof Error && error.name === 'ExitPromptError';
}

function buildNonInteractiveAnswers(seed: PromptSeed, interactive: boolean): PromptAnswers {
  if (seed.projectName === undefined) {
    throw userInputError(
      interactive
        ? 'Non-interactive runs require a project name.'
        : 'DeployMonk could not open an interactive prompt because the terminal is not interactive.',
      'Pass --name <name> (and optionally --template, --dir), or run DeployMonk from a real terminal.'
    );
  }
  const projectName = assertValidProjectName(seed.projectName);
  const requestedTemplate: string = seed.templateId ?? DEFAULT_TEMPLATE_ID;
  if (!isTemplateId(requestedTemplate)) {
    throw userInputError(
      `Unknown template: ${requestedTemplate}`,
      `Available templates: ${listTemplateIds().join(', ')}.`
    );
  }
  const templateId: TemplateId = requestedTemplate;
  const template = getTemplate(templateId);

  return {
    projectName,
    templateId,
    targetDir: assertValidTargetDirectory(seed.targetDir ?? suggestTargetDirectory(projectName)),
    authorName: seed.authorName === undefined ? undefined : assertValidAuthorName(seed.authorName),
    defaultPort:
      seed.defaultPort === undefined ? template.defaultPort : assertValidPort(seed.defaultPort),
    overwrite: parseOverwrite(seed.overwrite),
    install: parseInstall(seed.install),
  };
}

function parseOverwrite(value: string | undefined): OverwriteStrategy {
  if (value === undefined) return 'abort';
  if (value === 'abort' || value === 'merge' || value === 'replace') return value;
  throw userInputError(
    `Unknown --overwrite value: ${value}`,
    'Valid values: abort, merge, replace.'
  );
}

function parseInstall(value: string | undefined): InstallStrategy {
  if (value === undefined) return 'auto';
  if (value === 'always' || value === 'auto' || value === 'never') return value;
  throw userInputError(`Unknown --install value: ${value}`, 'Valid values: always, auto, never.');
}

function printPlan(answers: PromptAnswers): void {
  const template = getTemplate(answers.templateId);
  log.blank();
  log.raw(`  ${color.bold('Dry run - nothing was written to disk.')}`);
  printKeyValue([
    ['project', answers.projectName],
    ['template', `${template.id} (${template.label})`],
    ['directory', displayPath(answers.targetDir)],
    ['author', answers.authorName ?? '(current user)'],
    ['port', String(answers.defaultPort)],
    ['on conflict', answers.overwrite],
    ['install deps', answers.install],
  ]);
  log.blank();
}

function createPhaseReporter(): {
  reporter: ProgressReporter;
  finish: (result: ScaffoldResult) => void;
} {
  let current: DeployMonkSpinner | null = null;

  const reporter: ProgressReporter = (_phase, message) => {
    if (current !== null) current.succeed();
    current = createSpinner(message);
  };

  const finish = (result: ScaffoldResult): void => {
    const spinner = current ?? createSpinner('Finishing up');
    current = null;
    for (const outcome of result.installReport.outcomes) {
      if (outcome.installed) {
        spinner.succeed(outcome.message);
      } else if (outcome.error === null) {
        spinner.info(outcome.message);
      } else {
        spinner.warn(outcome.message);
      }
    }
    if (result.installReport.outcomes.length === 0) {
      spinner.succeed('Project files generated.');
    }
  };

  return { reporter, finish };
}

function printSummary(result: ScaffoldResult): void {
  const template = result.template;

  log.blank();
  log.success(
    `${template.label} project ${color.bold(result.values.projectName)} created in ${color.bold(displayPath(result.targetDir))}`
  );
  log.blank();

  printKeyValue([
    ['project', result.values.projectName],
    ['package', result.values.packageName],
    ['author', result.values.authorName],
    ['port', String(result.values.defaultPort)],
    ['files', String(result.fileCount)],
    ['placeholders', `${result.replacementResult.modifiedFiles.length} file(s) rewritten`],
  ]);

  for (const outcome of result.installReport.outcomes) {
    if (!outcome.installed && outcome.error !== null) {
      log.warn(`Dependency installation did not complete: ${outcome.error}`);
    }
  }

  log.blank();
  log.raw(`  ${color.bold('Next steps')}`);
  log.raw(`    ${color.gray('$')} ${color.cyan(`cd ${displayPath(result.targetDir)}`)}`);
  for (const step of result.nextSteps) {
    log.raw(`    ${color.gray('$')} ${step}`);
  }
  log.blank();
  log.raw(`  ${color.gray('Happy shipping.')}`);
  log.blank();
}

export async function main(argv: readonly string[] = []): Promise<void> {
  let flags: CliFlags;
  try {
    flags = parseArgs(argv);
    if (flags.noColor) setColorEnabled(false);
    if (flags.debug) process.env['DEPLOYMONK_DEBUG'] = '1';

    if (flags.help) {
      log.raw(HELP_TEXT);
      exitSuccessfully();
      return;
    }
    if (flags.version) {
      log.raw(DEPLOYMONK_VERSION);
      exitSuccessfully();
      return;
    }
    if (flags.list) {
      printTemplateList();
      exitSuccessfully();
      return;
    }
    assertNoUnknownFlags(flags);
  } catch (error) {
    exitWithError(error);
    return;
  }

  try {
    printBanner(DEPLOYMONK_VERSION);

    const interactive = isInteractive();
    const answers =
      flags.yes || !interactive
        ? buildNonInteractiveAnswers(flags.seed, interactive)
        : await runPromptFlow(flags.seed);

    if (flags.dryRun) {
      printPlan(answers);
      exitSuccessfully();
      return;
    }

    const { reporter, finish } = createPhaseReporter();
    const result = await scaffoldProject({
      projectName: answers.projectName,
      templateId: answers.templateId,
      targetDir: answers.targetDir,
      authorName: answers.authorName,
      defaultPort: answers.defaultPort,
      overwrite: answers.overwrite,
      install: answers.install,
      onProgress: reporter,
    });

    finish(result);
    printSummary(result);
    exitSuccessfully();
  } catch (error) {
    if (isCancellation(error)) {
      log.blank();
      log.warn('Aborted by user. Nothing was changed.');
      exitWithError(new DeployMonkError('user-input', 'Scaffolding cancelled by the user.'), 1);
      return;
    }
    exitWithError(error);
  }
}

export const HELP = HELP_TEXT;
export const CLI_VERSION = DEPLOYMONK_VERSION;
