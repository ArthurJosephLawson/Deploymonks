import inquirer from 'inquirer';

import {
  DEFAULT_TEMPLATE_ID,
  TEMPLATES,
  getTemplate,
  isTemplateId,
  type TemplateId,
} from '../core/copyTemplates.js';
import { DeployMonkError } from '../core/errors.js';
import { isEmptyDirectory, pathExists, type OverwriteStrategy } from '../core/filesystem.js';
import type { InstallStrategy } from '../core/installer.js';
import { color, log } from '../utils/log.js';
import {
  assertValidAuthorName,
  assertValidPort,
  assertValidProjectName,
  assertValidTargetDirectory,
  suggestTargetDirectory,
} from './validate.js';

export type PromptAnswers = {
  readonly projectName: string;
  readonly templateId: TemplateId;
  readonly targetDir: string;
  readonly authorName: string | undefined;
  readonly defaultPort: number;
  readonly overwrite: OverwriteStrategy;
  readonly install: InstallStrategy;
};

export type PromptSeed = {
  readonly projectName?: string;
  readonly templateId?: string;
  readonly targetDir?: string;
  readonly authorName?: string;
  readonly defaultPort?: number;
  readonly overwrite?: string;
  readonly install?: string;
};

type Validator<T> = (value: string) => T;

const promptValidator =
  <T>(validator: Validator<T>) =>
  (input: string): boolean | string => {
    try {
      validator(input);
      return true;
    } catch (error) {
      if (error instanceof DeployMonkError) return error.message;
      return error instanceof Error ? error.message : String(error);
    }
  };

const templateChoices = TEMPLATES.map((template) => ({
  name: template.label,
  value: template.id,
  description: `${template.description} (default port ${template.defaultPort})`,
}));

async function askProjectName(seed: string | undefined): Promise<string> {
  if (seed !== undefined) {
    return assertValidProjectName(seed);
  }
  const { projectName } = await inquirer.prompt<{ projectName: string }>([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name',
      validate: promptValidator(assertValidProjectName),
      filter: (value: string) => value.trim(),
    },
  ]);
  return assertValidProjectName(projectName);
}

async function askTemplate(seed: string | undefined): Promise<TemplateId> {
  if (seed !== undefined) {
    if (!isTemplateId(seed)) {
      throw new DeployMonkError('user-input', `Unknown template: ${seed}`, {
        details: [`Available templates: ${TEMPLATES.map((t) => t.id).join(', ')}`],
      });
    }
    return seed;
  }
  const { templateId } = await inquirer.prompt<{ templateId: TemplateId }>([
    {
      type: 'list',
      name: 'templateId',
      message: 'Which template should DeployMonk use?',
      choices: templateChoices,
      default: DEFAULT_TEMPLATE_ID,
    },
  ]);
  return templateId;
}

async function askTargetDirectory(seed: string | undefined, projectName: string): Promise<string> {
  if (seed !== undefined) {
    return assertValidTargetDirectory(seed);
  }
  const { targetDir } = await inquirer.prompt<{ targetDir: string }>([
    {
      type: 'input',
      name: 'targetDir',
      message: 'Target directory',
      default: suggestTargetDirectory(projectName),
      validate: promptValidator(assertValidTargetDirectory),
      filter: (value: string) => value.trim(),
    },
  ]);
  return assertValidTargetDirectory(targetDir);
}

async function askAuthorName(seed: string | undefined): Promise<string | undefined> {
  if (seed !== undefined) {
    return assertValidAuthorName(seed);
  }
  const { authorName } = await inquirer.prompt<{ authorName: string }>([
    {
      type: 'input',
      name: 'authorName',
      message: 'Author name (optional)',
      default: '',
      validate: promptValidator(assertValidAuthorName),
      filter: (value: string) => value.trim(),
    },
  ]);
  return assertValidAuthorName(authorName);
}

async function askPort(seed: number | undefined, templateId: TemplateId): Promise<number> {
  const template = getTemplate(templateId);
  if (seed !== undefined) {
    return assertValidPort(seed);
  }
  const { port } = await inquirer.prompt<{ port: string }>([
    {
      type: 'input',
      name: 'port',
      message: `${template.portLabel} for ${template.label}`,
      default: String(template.defaultPort),
      validate: (input: string): boolean | string => {
        if (input.trim() === '') return true;
        return promptValidator(assertValidPort)(input);
      },
      filter: (value: string) => value.trim(),
    },
  ]);
  if (port.trim() === '') return template.defaultPort;
  return assertValidPort(port);
}

async function askOverwrite(
  seed: string | undefined,
  targetDir: string
): Promise<OverwriteStrategy> {
  if (seed !== undefined) {
    if (seed === 'abort' || seed === 'merge' || seed === 'replace') return seed;
    throw new DeployMonkError('user-input', `Unknown --overwrite value: ${seed}`, {
      details: ['Valid values: abort, merge, replace.'],
    });
  }
  if (!(await pathExists(targetDir)) || (await isEmptyDirectory(targetDir))) {
    return 'abort';
  }

  const { overwrite } = await inquirer.prompt<{ overwrite: OverwriteStrategy }>([
    {
      type: 'list',
      name: 'overwrite',
      message: `Target directory ${color.yellow(targetDir)} is not empty. How should DeployMonk proceed?`,
      choices: [
        { name: 'Abort and keep my files', value: 'abort' },
        { name: 'Merge (overwrite template files only)', value: 'merge' },
        { name: 'Replace (delete everything first)', value: 'replace' },
      ],
      default: 'abort',
    },
  ]);
  return overwrite;
}

async function askInstall(
  seed: string | undefined,
  templateId: TemplateId
): Promise<InstallStrategy> {
  const template = getTemplate(templateId);
  if (seed !== undefined) {
    if (seed === 'always' || seed === 'auto' || seed === 'never') return seed;
    throw new DeployMonkError('user-input', `Unknown --install value: ${seed}`, {
      details: ['Valid values: always, auto, never.'],
    });
  }
  const { install } = await inquirer.prompt<{ install: InstallStrategy }>([
    {
      type: 'list',
      name: 'install',
      message: `Install ${template.packageManager === 'npm' ? 'Node' : 'Python'} dependencies now?`,
      choices: [
        { name: 'Yes, install them now', value: 'auto' },
        { name: 'No, I will install them myself', value: 'never' },
      ],
      default: 'auto',
    },
  ]);
  return install;
}

export async function runPromptFlow(seed: PromptSeed = {}): Promise<PromptAnswers> {
  const projectName = await askProjectName(seed.projectName);
  const templateId = await askTemplate(seed.templateId);
  const targetDir = await askTargetDirectory(seed.targetDir, projectName);
  const authorName = await askAuthorName(seed.authorName);
  const defaultPort = await askPort(seed.defaultPort, templateId);
  const overwrite = await askOverwrite(seed.overwrite, targetDir);
  const install = await askInstall(seed.install, templateId);

  log.blank();
  log.info('Configuration ready. Scaffolding begins.');

  return { projectName, templateId, targetDir, authorName, defaultPort, overwrite, install };
}
