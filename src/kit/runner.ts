import fs from 'node:fs/promises';
import path from 'node:path';

import fg from 'fast-glob';
import { err, ok } from 'neverthrow';

import { compactMap } from '../utils/arrays.ts';
import { collectionIsEmpty } from './collections.ts';
import type { CodemodConfig } from './config.ts';
import { LANG_TO_EXTENSIONS_MAPPING } from './constants.ts';
import { CodemodTargetNotFoundError } from './errors.ts';
import { toError, tryCatchAsync } from './result.ts';
import type { Codemod, RunCodemodOkResult, RunCodemodResult } from './types.ts';

type RunCodemodHooks<C extends Codemod = Codemod> = {
  targetFiltering?: (filepath: string, codemod: C) => boolean;
  preCodemodRun?: (codemod: C) => Promise<void>;
  postTransform?: (transformedContent: string, codemod: C) => Promise<string>;
};

type RunCodemodOptions<C extends Codemod = Codemod> = {
  hooks?: RunCodemodHooks<C>;
  rootPaths?: Array<string>;
};

type ResolvedTarget = { fullPath: string; filepath: string; root: string };

/** Directories that are never a codemod's business: installed packages and build output. */
const IGNORED_DIRECTORY_GLOBS = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'];

function getSupportedExtensions<C extends Codemod = Codemod>(codemod: C): Set<string> {
  return new Set(
    Array.from(codemod.languages).reduce<Array<string>>((acc, language) => {
      const mappedExtensions = LANG_TO_EXTENSIONS_MAPPING[language.toLowerCase()];
      if (mappedExtensions == null) return acc;

      return acc.concat(Array.from(mappedExtensions));
    }, []),
  );
}

async function transformFile<C extends Codemod = Codemod>(
  codemod: C,
  fullPath: string,
  filepath: string,
  hooks: Required<RunCodemodHooks<C>>,
  enableLogging: boolean,
  runInDryMode: boolean,
  root: string,
): Promise<RunCodemodResult> {
  try {
    const content = await fs.readFile(fullPath, { encoding: 'utf-8' });
    const modifiedContent = await codemod.transformer(content, fullPath);
    const hasChanges = modifiedContent !== content;
    if (hasChanges) {
      const transformedContent = await hooks.postTransform(modifiedContent, codemod);
      if (!runInDryMode) {
        await fs.writeFile(fullPath, transformedContent);
      }
      if (enableLogging) {
        console.log(`🚀 finished '${codemod.name}'`, { filename: filepath });
      }
    }

    return ok({ hasChanges, content: modifiedContent, fullPath, root });
  } catch (error) {
    if (enableLogging) {
      console.error(`❌ '${codemod.name}' failed to parse file`, filepath, error);
    }

    return err(toError(error));
  }
}

async function runPostTransformHook<C extends Codemod = Codemod>(
  codemod: C,
  results: Array<RunCodemodResult>,
  rootPaths: Array<string>,
): Promise<void> {
  const successes: Array<RunCodemodOkResult> = compactMap(results, result => {
    if (result.isErr()) return undefined;

    return result.value;
  });
  const rootPathsWithResults: Array<{ root: string; results: Array<RunCodemodOkResult> }> = rootPaths.map(root => ({
    root,
    results: successes.filter(success => success.fullPath.startsWith(`${root}${path.sep}`) || success.root === root),
  }));
  await Promise.all(rootPathsWithResults.map(r => (codemod.postTransform ?? (async () => {}))(r, codemod)));
}

async function resolveDirectoryTargets<C extends Codemod = Codemod>(
  codemod: C,
  transformationPath: string,
  hooks: Required<RunCodemodHooks<C>>,
): Promise<Array<ResolvedTarget>> {
  const globItems = await fg.glob(['**/*'], { cwd: transformationPath, ignore: IGNORED_DIRECTORY_GLOBS });
  const extensions = getSupportedExtensions(codemod);
  const codemodTargetFiltering = codemod.targetFiltering ?? (() => true);
  const targets = globItems.filter(filepath => {
    if (!hooks.targetFiltering(filepath, codemod)) return false;
    if (!codemodTargetFiltering(filepath, codemod)) return false;

    return collectionIsEmpty(extensions) || extensions.has(path.extname(filepath));
  });

  return targets.map(filepath => ({
    fullPath: path.resolve(transformationPath, filepath),
    filepath,
    root: path.resolve(transformationPath, filepath.split('/')[0] ?? filepath),
  }));
}

function resolveFileTarget<C extends Codemod = Codemod>(
  codemod: C,
  transformationPath: string,
  hooks: Required<RunCodemodHooks<C>>,
): ResolvedTarget | undefined {
  const filepath = path.basename(transformationPath);
  const extensions = getSupportedExtensions(codemod);
  const codemodTargetFiltering = codemod.targetFiltering ?? (() => true);
  const isTarget =
    hooks.targetFiltering(filepath, codemod) &&
    codemodTargetFiltering(filepath, codemod) &&
    (collectionIsEmpty(extensions) || extensions.has(path.extname(filepath)));
  if (!isTarget) return undefined;

  const fullPath = path.resolve(transformationPath);

  return { fullPath, filepath, root: path.dirname(fullPath) };
}

async function resolveTargetsForPath<C extends Codemod = Codemod>(
  codemod: C,
  transformationPath: string,
  hooks: Required<RunCodemodHooks<C>>,
): Promise<Array<ResolvedTarget>> {
  const statResult = await tryCatchAsync(() => fs.stat(transformationPath));
  if (statResult.isErr()) {
    throw new CodemodTargetNotFoundError(transformationPath, { cause: toError(statResult.error) });
  }

  if (statResult.value.isFile()) {
    const target = resolveFileTarget(codemod, transformationPath, hooks);

    return target == null ? [] : [target];
  }

  return resolveDirectoryTargets(codemod, transformationPath, hooks);
}

function dedupeTargetsByFullPath(targetsPerPath: Array<Array<ResolvedTarget>>): Array<ResolvedTarget> {
  const seenFullPaths = new Set<string>();

  return targetsPerPath.flat().filter(target => {
    if (seenFullPaths.has(target.fullPath)) return false;

    seenFullPaths.add(target.fullPath);

    return true;
  });
}

function defaultedHooks<C extends Codemod = Codemod>(hooks?: RunCodemodHooks<C>): Required<RunCodemodHooks<C>> {
  const targetFiltering = hooks?.targetFiltering ?? (() => true);
  const postTransform = hooks?.postTransform ?? (content => Promise.resolve(content));
  const preCodemodRun = hooks?.preCodemodRun ?? (async () => {});

  return { targetFiltering, postTransform, preCodemodRun };
}

export async function runCodemod<C extends Codemod = Codemod>(
  codemod: C,
  config: CodemodConfig,
  options?: RunCodemodOptions<C>,
): Promise<Array<RunCodemodResult>> {
  const hooks = defaultedHooks<C>(options?.hooks);
  const rootPaths = options?.rootPaths ?? [];
  const enableLogging = config.log ?? true;
  const runInDryMode = config.dry_run ?? false;

  await hooks.preCodemodRun(codemod);

  const targetsPerPath = await Promise.all(
    config.paths.map(transformationPath => resolveTargetsForPath(codemod, transformationPath, hooks)),
  );
  const targets = dedupeTargetsByFullPath(targetsPerPath);
  if (targets.length === 0) return [];

  if (enableLogging) {
    console.log(
      `🧉 '${codemod.name}' targeting ${targets.length} ${targets.length === 1 ? 'file' : 'files'} to transform, chill and grab some maté`,
    );
  }

  const results = await Promise.all(
    targets.map(target =>
      transformFile(codemod, target.fullPath, target.filepath, hooks, enableLogging, runInDryMode, target.root),
    ),
  );

  // postTransform writes project files of its own, so a dry run must not reach it.
  if (!runInDryMode) await runPostTransformHook(codemod, results, rootPaths);

  return results;
}
