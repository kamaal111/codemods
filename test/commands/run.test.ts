import { test, expect } from '@rstest/core';

import { captureLog } from '../test-utils/capture-output.ts';
import { runCodemodCommand } from '../test-utils/cli-entry.ts';

test('that it runs run', async () => {
  const { stdout } = await captureLog(() => runCodemodCommand('joi-to-zod', ['test/resources', '-d']));

  expect(stdout).include('transformation took ');
});

test('that it runs run against a single file', async () => {
  const { stdout } = await captureLog(() => runCodemodCommand('joi-to-zod', ['test/resources/joi-imports.ts', '-d']));

  expect(stdout).include('transformation took ');
});

test('that --no-log suppresses the timing line', async () => {
  const { stdout } = await captureLog(() => runCodemodCommand('joi-to-zod', ['test/resources', '-d', '--no-log']));

  expect(stdout).not.include('transformation took ');
});

test('that it errors on a path that does not exist', async () => {
  const { error } = await captureLog(() => runCodemodCommand('joi-to-zod', ['test/resources/does-not-exist.ts', '-d']));

  expect(error?.message).include("No file or directory found at 'test/resources/does-not-exist.ts'");
});

test('that it runs run with a config file', async () => {
  const { stdout } = await captureLog(() =>
    runCodemodCommand('joi-to-zod', ['--config', 'test/resources/joi-migration-phase1.json', '-d']),
  );

  expect(stdout).include('transformation took ');
});

test('that it errors when both --config and a path argument are given', async () => {
  const { error } = await captureLog(() =>
    runCodemodCommand('joi-to-zod', ['test/resources', '--config', 'test/resources/joi-migration-phase1.json', '-d']),
  );

  expect(error?.message).include("Cannot use '--config' together with a path argument. Choose one.");
});

test('that it errors when a config path does not exist', async () => {
  const { error } = await captureLog(() =>
    runCodemodCommand('joi-to-zod', ['--config', 'test/resources/joi-migration-invalid.json', '-d']),
  );

  expect(error?.message).include("No file or directory found at 'test/resources/does-not-exist.ts'");
});

test('that it errors when the config file itself does not exist', async () => {
  const { error } = await captureLog(() =>
    runCodemodCommand('joi-to-zod', ['--config', 'test/resources/does-not-exist.json', '-d']),
  );

  expect(error?.message).include("No config file found at 'test/resources/does-not-exist.json'");
});

test('that it errors when the config file fails schema validation', async () => {
  const { error } = await captureLog(() =>
    runCodemodCommand('joi-to-zod', ['--config', 'test/resources/joi-migration-bad-schema.json', '-d']),
  );

  expect(error?.message).include(
    "Config file at 'test/resources/joi-migration-bad-schema.json' failed schema validation",
  );
});

test('that a config dry_run runs without the --dry flag', async () => {
  const { stdout } = await captureLog(() =>
    runCodemodCommand('joi-to-zod', ['--config', 'test/resources/joi-migration-dry.json']),
  );

  expect(stdout).include('transformation took ');
});

test('that it errors when both --dry and a config dry_run are given', async () => {
  const { error } = await captureLog(() =>
    runCodemodCommand('joi-to-zod', ['--config', 'test/resources/joi-migration-dry.json', '-d']),
  );

  expect(error?.message).include("Cannot use '--dry' together with 'dry_run' in the config file. Choose one.");
});

test('that it runs run with a config listing multiple paths', async () => {
  const { stdout } = await captureLog(() =>
    runCodemodCommand('joi-to-zod', ['--config', 'test/resources/joi-migration-multi.json', '-d']),
  );

  expect(stdout).include('transformation took ');
});

test('that a config log: false suppresses the timing line without --no-log', async () => {
  const { stdout } = await captureLog(() =>
    runCodemodCommand('joi-to-zod', ['--config', 'test/resources/joi-migration-log.json', '-d']),
  );

  expect(stdout).not.include('transformation took ');
});

test('that it errors when both --no-log and a config log are given', async () => {
  const { error } = await captureLog(() =>
    runCodemodCommand('joi-to-zod', ['--config', 'test/resources/joi-migration-log.json', '-d', '--no-log']),
  );

  expect(error?.message).include("Cannot use '--no-log' together with 'log' in the config file. Choose one.");
});

test('that uppercase short flag aliases work', async () => {
  const { stdout } = await captureLog(() => runCodemodCommand('joi-to-zod', ['test/resources', '-D', '-N']));

  expect(stdout).not.include('transformation took ');
});

test('that an unknown flag is rejected', async () => {
  const { error } = await captureLog(() => runCodemodCommand('joi-to-zod', ['test/resources', '--not-a-flag']));

  expect(error?.message).toBeDefined();
});

test('that an unexpected extra positional argument is rejected', async () => {
  const { error } = await captureLog(() => runCodemodCommand('joi-to-zod', ['test/resources', 'extra']));

  expect(error?.message).include("Unexpected argument 'extra'.");
});
