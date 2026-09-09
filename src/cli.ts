import packageJSON from '../package.json' with { type: 'json' };
import { CODEMOD_REGISTRY, codemodNames, isCodemodName } from './codemods/registry.ts';
import { listCommand } from './commands/list.ts';
import { makeRunHelpText, runCodemodCommand } from './commands/run.ts';
import { CliUsageError } from './errors.ts';

const HELP_FLAGS = new Set(['-h', '--help']);
const VERSION_FLAGS = new Set(['-v', '--version']);

function topLevelHelpText(): string {
  const names = codemodNames();
  const longestName = Math.max(...names.map(name => name.length));
  const codemodLines = names.map(name => `  ${name.padEnd(longestName)}  ${CODEMOD_REGISTRY[name].summary}`).join('\n');

  return `Run a codemod over your source tree.

USAGE
  $ codemods [CODEMOD] [PATH] [FLAGS]

CODEMODS
${codemodLines}

COMMANDS
  ${'list'.padEnd(longestName)}  List the available codemods

Run '$ codemods <codemod> --help' for codemod-specific usage.
`;
}

export async function run(argv: Array<string> = process.argv.slice(2)): Promise<void> {
  const [command, ...rest] = argv;

  if (command === undefined || HELP_FLAGS.has(command)) {
    console.log(topLevelHelpText());
    return;
  }

  if (VERSION_FLAGS.has(command)) {
    console.log(packageJSON.version);
    return;
  }

  if (command === 'list') {
    if (rest.some(arg => HELP_FLAGS.has(arg))) {
      console.log(topLevelHelpText());
      return;
    }

    listCommand();
    return;
  }

  if (!isCodemodName(command)) {
    handleError(`Unknown codemod '${command}'. Run 'codemods --help' for a list of available codemods.`, true);
    return;
  }

  if (rest.some(arg => HELP_FLAGS.has(arg))) {
    console.log(makeRunHelpText(command));
    return;
  }

  try {
    await runCodemodCommand(command, rest);
  } catch (error) {
    if (error instanceof CliUsageError) {
      handleError(error.message, true);
      return;
    }

    handleError(error instanceof Error ? error.message : String(error), false);
  }
}

function handleError(message: string, isUsageError: boolean): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = isUsageError ? 2 : 1;
}
