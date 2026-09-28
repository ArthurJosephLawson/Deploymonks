import os from 'node:os';
import path from 'node:path';

import {
  copyTemplate,
  getTemplate,
  type TemplateDefinition,
  type TemplateId,
} from './copyTemplates.js';
import {
  applyTemplateRenames,
  countFiles,
  prepareTargetDirectory,
  writeJsonFile,
  type OverwriteStrategy,
} from './filesystem.js';
import { installDependencies, type InstallReport, type InstallStrategy } from './installer.js';
import {
  assertNoUnresolvedPlaceholders,
  replacePlaceholdersInTree,
  type ReplacementResult,
  type Replacements,
} from './placeholders.js';

export const DEPLOYMONK_VERSION = '1.0.0';

export const MANIFEST_FILENAME = '.deploymonk.json';

export type ScaffoldPhase = 'prepare' | 'copy' | 'placeholders' | 'verify' | 'manifest' | 'install';

export type ProgressReporter = (phase: ScaffoldPhase, message: string) => void;

export type ScaffoldOptions = {
  readonly projectName: string;
  readonly templateId: TemplateId;
  readonly targetDir: string;
  readonly authorName?: string | undefined;
  readonly defaultPort: number;
  readonly overwrite?: OverwriteStrategy;
  readonly install?: InstallStrategy;
  readonly onProgress?: ProgressReporter | undefined;
};

export type ProjectValues = {
  readonly projectName: string;
  readonly packageName: string;
  readonly authorName: string;
  readonly defaultPort: number;
  readonly projectSlug: string;
  readonly year: number;
};

export type GenerateResult = {
  readonly values: ProjectValues;
  readonly template: TemplateDefinition;
  readonly targetDir: string;
  readonly fileCount: number;
  readonly replacements: Replacements;
  readonly replacementResult: ReplacementResult;
  readonly cleared: boolean;
  readonly preserved: readonly string[];
};

export type ScaffoldResult = GenerateResult & {
  readonly installReport: InstallReport;
  readonly nextSteps: readonly string[];
};

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'project' : slug;
}

export function toPackageName(projectName: string): string {
  const name = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-._~]+/g, '-')
    .replace(/^[._~]+/, '')
    .replace(/-+$/, '');
  const safe = name === '' ? 'app' : name;
  return safe.length > 214 ? safe.slice(0, 214).replace(/-+$/, '') : safe;
}

function defaultAuthorName(): string {
  try {
    const username = os.userInfo().username?.trim();
    if (username !== undefined && username !== '') {
      return username;
    }
  } catch {
    return 'Unknown';
  }
  return 'Unknown';
}

export function resolveProjectValues(options: {
  readonly projectName: string;
  readonly authorName?: string | undefined;
  readonly defaultPort: number;
  readonly year?: number;
}): ProjectValues {
  const authorName = options.authorName?.trim();
  return {
    projectName: options.projectName.trim(),
    packageName: toPackageName(options.projectName),
    authorName: authorName !== undefined && authorName !== '' ? authorName : defaultAuthorName(),
    defaultPort: options.defaultPort,
    projectSlug: slugify(options.projectName),
    year: options.year ?? new Date().getFullYear(),
  };
}

export function buildReplacements(values: ProjectValues): Replacements {
  return new Map<string, string>([
    ['PROJECT_NAME', values.projectName],
    ['PACKAGE_NAME', values.packageName],
    ['AUTHOR_NAME', values.authorName],
    ['DEFAULT_PORT', String(values.defaultPort)],
    ['PROJECT_SLUG', values.projectSlug],
    ['PROJECT_YEAR', String(values.year)],
  ]);
}

const noopReporter: ProgressReporter = () => {};

function renderTemplate(text: string, values: ProjectValues): string {
  return text.replace(/\{\{DEFAULT_PORT\}\}/g, String(values.defaultPort));
}

export async function generateProject(options: ScaffoldOptions): Promise<GenerateResult> {
  const report = options.onProgress ?? noopReporter;
  const template = getTemplate(options.templateId);
  const values = resolveProjectValues({
    projectName: options.projectName,
    authorName: options.authorName,
    defaultPort: options.defaultPort,
  });
  const replacements = buildReplacements(values);
  const targetDir = path.resolve(options.targetDir);

  report('prepare', `Preparing ${path.basename(targetDir)}`);
  const preparation = await prepareTargetDirectory(targetDir, options.overwrite ?? 'abort');

  report('copy', `Copying the ${template.label} template`);
  await copyTemplate(template.id, preparation.targetDir);
  await applyTemplateRenames(preparation.targetDir);

  report('placeholders', 'Replacing placeholders');
  const replacementResult = await replacePlaceholdersInTree(preparation.targetDir, replacements);

  report('manifest', 'Writing the DeployMonk manifest');
  await writeJsonFile(path.join(preparation.targetDir, MANIFEST_FILENAME), {
    generator: 'deploymonk',
    generatorVersion: DEPLOYMONK_VERSION,
    template: template.id,
    projectName: values.projectName,
    packageName: values.packageName,
    defaultPort: values.defaultPort,
    filesCopied: replacementResult.scannedFiles,
  });

  report('verify', 'Verifying the generated project');
  await assertNoUnresolvedPlaceholders(preparation.targetDir);
  const fileCount = await countFiles(preparation.targetDir);

  return {
    values,
    template,
    targetDir: preparation.targetDir,
    fileCount,
    replacements,
    replacementResult,
    cleared: preparation.cleared,
    preserved: preparation.preserved,
  };
}

export async function scaffoldProject(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const report = options.onProgress ?? noopReporter;
  const strategy = options.install ?? 'auto';
  const generated = await generateProject(options);

  report('install', `Installing ${generated.template.packageManager} dependencies`);
  const installReport = await installDependencies({
    template: generated.template,
    targetDir: generated.targetDir,
    strategy,
  });

  const nextSteps = generated.template.nextSteps.map((step) =>
    renderTemplate(step, generated.values)
  );

  return { ...generated, installReport, nextSteps };
}
