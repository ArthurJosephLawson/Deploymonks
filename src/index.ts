export {
  DEFAULT_TEMPLATE_ID,
  TEMPLATES,
  getTemplate,
  isTemplateId,
  listTemplateIds,
  resolveTemplateDir,
  copyTemplate,
  listTemplateFiles,
  type TemplateDefinition,
  type TemplateId,
} from './core/copyTemplates.js';

export { DeployMonkError, describeCause } from './core/errors.js';

export {
  assertUsableTargetDirectory,
  countFiles,
  isEmptyDirectory,
  pathExists,
  prepareTargetDirectory,
  type OverwriteStrategy,
} from './core/filesystem.js';

export { installDependencies, type InstallReport, type InstallStrategy } from './core/installer.js';

export {
  PLACEHOLDER_KEYS,
  assertNoUnresolvedPlaceholders,
  extractTokens,
  findUnresolvedPlaceholders,
  isTextFile,
  replaceInFile,
  replaceInString,
  replacePlaceholdersInTree,
  type PlaceholderKey,
  type Replacements,
} from './core/placeholders.js';

export {
  DEPLOYMONK_VERSION,
  MANIFEST_FILENAME,
  buildReplacements,
  generateProject,
  resolveProjectValues,
  scaffoldProject,
  slugify,
  toPackageName,
  type GenerateResult,
  type ProjectValues,
  type ScaffoldOptions,
  type ScaffoldResult,
} from './core/scaffold.js';

export {
  collectSystemReport,
  probeCommand,
  runCommand,
  type SystemReport,
} from './core/systemCheck.js';

export { main } from './cli/index.js';
