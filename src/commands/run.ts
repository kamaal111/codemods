import nodePath from 'node:path';
import { parseArgs } from 'node:util';

import { CODEMOD_REGISTRY, type CodemodName } from '../codemods/registry.ts';
import { CliUsageError } from '../errors.ts';
import { loadCodemodConfig, type CodemodConfig } from '../kit/config.ts';
import { runCodemod } from '../kit/runner.ts';
import { findRecordValue } from '../utils/objects.ts';

const DEFAULT_DRY_RUN_OPTION = false;
const DEFAULT_NO_LOG_OPTION = false;
const DEFAULT_PATH_ARG = '.';

/** Mirrors oclif's `charAliases`: accept the uppercase short flag as an alias for the lowercase one. */
const UPPERCASE_SHORT_FLAG_ALIASES = { '-C': '-c', '-D': '-d', '-N': '-n' } satisfies Record<string, string>;

type RunFlags = { config: string | undefined; dry: boolean; 'no-log': boolean };
type ParsedRunArgs = { flags: RunFlags; path: string };

export function makeRunHelpText(name: CodemodName): string {
  return `${CODEMOD_REGISTRY[name].summary}

USAGE
  $ codemods ${name} [PATH] [-d] [-n] [-c <value>]

ARGUMENTS
  PATH  The file or directory path to transform (default: ".")

FLAGS
  -c, --config=<value>  Path to a JSON config file listing the paths to migrate (mutually exclusive with the path argument)
  -d, --dry              When enabled the transformer will not write to the file but print what would have changed instead
  -n, --no-log           When enabled no logs will be displayed

EXAMPLES
  $ codemods ${name}
  $ codemods ${name} ./src --dry
`;
}

export async function runCodemodCommand(name: CodemodName, argv: Array<string>): Promise<void> {
  const start = performance.now();
  const { flags, path } = parseRunArgs(argv);

  if (flags.config != null && path !== DEFAULT_PATH_ARG) {
    throw new CliUsageError("Cannot use '--config' together with a path argument. Choose one.");
  }

  const config = await resolveConfig(flags, path);

  // A codemod's postTransform migrates the project around the files it rewrote -- generating
  // configs, updating manifests -- so hand it the paths the run was pointed at.
  await runCodemod(CODEMOD_REGISTRY[name].codemod, config, {
    rootPaths: config.paths.map(configPath => nodePath.resolve(configPath)),
  });

  const end = performance.now();
  if (config.log !== false) {
    console.log(`✨ transformation took ${(end - start).toFixed(2)} milliseconds`);
  }
}

function parseRunArgs(argv: Array<string>): ParsedRunArgs {
  const normalized = argv.map(arg => findRecordValue(UPPERCASE_SHORT_FLAG_ALIASES, arg) ?? arg);

  let values: { dry?: boolean; 'no-log'?: boolean; config?: string };
  let positionals: Array<string>;
  try {
    ({ values, positionals } = parseArgs({
      args: normalized,
      options: {
        dry: { type: 'boolean', short: 'd', default: DEFAULT_DRY_RUN_OPTION },
        ['no-log']: { type: 'boolean', short: 'n', default: DEFAULT_NO_LOG_OPTION },
        config: { type: 'string', short: 'c' },
      },
      allowPositionals: true,
      strict: true,
    }));
  } catch (error) {
    throw new CliUsageError(error instanceof Error ? error.message : String(error));
  }

  if (positionals.length > 1) {
    throw new CliUsageError(`Unexpected argument '${positionals[1]}'.`);
  }

  return {
    flags: {
      config: values.config,
      dry: values.dry ?? DEFAULT_DRY_RUN_OPTION,
      'no-log': values['no-log'] ?? DEFAULT_NO_LOG_OPTION,
    },
    path: positionals[0] ?? DEFAULT_PATH_ARG,
  };
}

async function resolveConfig(flags: RunFlags, path: string): Promise<CodemodConfig> {
  if (flags.config == null) {
    return { paths: [path], dry_run: flags.dry, log: !flags['no-log'] };
  }

  const config = await loadCodemodConfig(flags.config);

  if (flags.dry && config.dry_run !== undefined) {
    throw new CliUsageError("Cannot use '--dry' together with 'dry_run' in the config file. Choose one.");
  }
  if (flags['no-log'] && config.log !== undefined) {
    throw new CliUsageError("Cannot use '--no-log' together with 'log' in the config file. Choose one.");
  }

  return {
    ...config,
    dry_run: flags.dry || (config.dry_run ?? false),
    log: flags['no-log'] ? false : (config.log ?? true),
  };
}
