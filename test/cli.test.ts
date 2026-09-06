import { captureCli } from './test-utils/capture-output.ts';
import { run } from './test-utils/cli-entry.ts';

test('that no arguments prints the top-level help text', async () => {
  const { stdout, exitCode } = await captureCli(() => run([]));

  expect(stdout).include('USAGE');
  expect(stdout).include('COMMANDS');
  expect(exitCode).toBeUndefined();
});

test('that --help prints the top-level help text', async () => {
  const { stdout, exitCode } = await captureCli(() => run(['--help']));

  expect(stdout).include('USAGE');
  expect(exitCode).toBeUndefined();
});

test('that --version prints the package version', async () => {
  const { stdout, exitCode } = await captureCli(() => run(['--version']));

  expect(stdout).match(/^\d+\.\d+\.\d+$/);
  expect(exitCode).toBeUndefined();
});

test('that <codemod> --help prints the codemod help text', async () => {
  const { stdout, exitCode } = await captureCli(() => run(['joi-to-zod', '--help']));

  expect(stdout).include('Rewrite supported Joi schema patterns into Zod equivalents');
  expect(exitCode).toBeUndefined();
});

test('that an unknown command errors with exit code 2', async () => {
  const { stderr, exitCode } = await captureCli(() => run(['bogus']));

  expect(stderr).include("Unknown codemod 'bogus'");
  expect(exitCode).toBe(2);
});

test('that a usage error from a codemod exits with code 2', async () => {
  const { stderr, exitCode } = await captureCli(() =>
    run(['joi-to-zod', 'test/resources', '--config', 'test/resources/joi-migration-phase1.json']),
  );

  expect(stderr).include("Cannot use '--config' together with a path argument. Choose one.");
  expect(exitCode).toBe(2);
});

test('that a non-usage error from a codemod exits with code 1', async () => {
  const { stderr, exitCode } = await captureCli(() => run(['joi-to-zod', 'test/resources/does-not-exist.ts']));

  expect(stderr).include("No file or directory found at 'test/resources/does-not-exist.ts'");
  expect(exitCode).toBe(1);
});

test('that it dispatches to the codemod on success', async () => {
  const { stdout, exitCode } = await captureCli(() => run(['joi-to-zod', 'test/resources', '-d']));

  expect(stdout).include('transformation took ');
  expect(exitCode).toBeUndefined();
});

test('that list prints the registered codemods', async () => {
  const { stdout, exitCode } = await captureCli(() => run(['list']));

  expect(stdout).include('joi-to-zod');
  expect(stdout).include('Rewrite supported Joi schema patterns into Zod equivalents');
  expect(exitCode).toBeUndefined();
});

test('that list help prints top-level help instead of the list output', async () => {
  const { stdout, exitCode } = await captureCli(() => run(['list', '--help']));

  expect(stdout).include('USAGE');
  expect(stdout).include('COMMANDS');
  expect(stdout).not.include('CODEMODS\njoi-to-zod');
  expect(exitCode).toBeUndefined();
});

test('that the top-level help lists the registered codemods', async () => {
  const { stdout } = await captureCli(() => run([]));

  expect(stdout).include('CODEMODS');
  expect(stdout).include('joi-to-zod');
});
