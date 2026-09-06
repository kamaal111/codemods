import { run as sourceRun } from '../../src/cli.ts';
import { runCodemodCommand as sourceRunCodemodCommand } from '../../src/commands/run.ts';

const useCompiled = process.env.CLI_ENTRY === 'dist';

const cliSpecifier: string = useCompiled ? '../../dist/cli.js' : '../../src/cli.ts';
const runCommandSpecifier: string = useCompiled ? '../../dist/commands/run.js' : '../../src/commands/run.ts';

export const run: typeof sourceRun = useCompiled ? (await import(cliSpecifier)).run : sourceRun;
export const runCodemodCommand: typeof sourceRunCodemodCommand = useCompiled
  ? (await import(runCommandSpecifier)).runCodemodCommand
  : sourceRunCodemodCommand;
