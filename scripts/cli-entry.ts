#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runs the CLI through either the TypeScript sources or the compiled build, so CI can
 * exercise both from a single script. Set `CLI_ENTRY=dist` to use `bin/run.mjs`.
 */
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = process.env.CLI_ENTRY === 'dist' ? 'bin/run.mjs' : 'bin/dev.mjs';

const child = spawn(process.execPath, [path.join(repositoryRoot, entry), ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal != null) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
