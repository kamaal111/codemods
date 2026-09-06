import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runCodemod } from '../../src/kit/runner.ts';
import type { Codemod } from '../../src/kit/types.ts';
import { captureLog } from '../test-utils/capture-output.ts';

async function withTemporaryDirectory<T>(callback: (directory: string) => Promise<T>): Promise<T> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codemods-runner-'));
  try {
    return await callback(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function makeCodemod(overrides: Partial<Codemod> = {}): Codemod {
  return {
    languages: new Set(['ts']),
    name: 'test-codemod',
    transformer: async content => content.replace('before', 'after'),
    ...overrides,
  };
}

test('transforms supported directory files once, applies hooks, and groups post-transform results by root', async () => {
  await withTemporaryDirectory(async directory => {
    await fs.mkdir(path.join(directory, 'nested'));
    const source = path.join(directory, 'nested', 'source.ts');
    await fs.writeFile(source, 'before');
    await fs.writeFile(path.join(directory, 'nested', 'ignored.txt'), 'before');

    const preRuns: Array<string> = [];
    const postTransforms: Array<string> = [];
    const groupedResults: Array<{ root: string; filenames: Array<string> }> = [];
    const codemod = makeCodemod({
      postTransform: async ({ root, results }) => {
        groupedResults.push({ root, filenames: results.map(result => path.basename(result.fullPath)) });
      },
    });

    const { stdout } = await captureLog(async () => {
      await runCodemod(
        codemod,
        { paths: [directory] },
        {
          rootPaths: [path.join(directory, 'nested'), path.join(directory, 'without-results')],
          hooks: {
            preCodemodRun: async current => {
              preRuns.push(current.name);
            },
            postTransform: async content => {
              postTransforms.push(content);
              return `${content}!`;
            },
          },
        },
      );
    });

    expect(preRuns).toEqual(['test-codemod']);
    expect(postTransforms).toEqual(['after']);
    expect(await fs.readFile(source, 'utf8')).toBe('after!');
    expect(groupedResults).toEqual([
      { root: path.join(directory, 'nested'), filenames: ['source.ts'] },
      { root: path.join(directory, 'without-results'), filenames: [] },
    ]);
    expect(stdout).include('targeting 1 file');
    expect(stdout).include("finished 'test-codemod'");
  });
});

test('filters unsupported files, leaves dry-run content on disk, and suppresses logs', async () => {
  await withTemporaryDirectory(async directory => {
    const supported = path.join(directory, 'source.ts');
    const unsupported = path.join(directory, 'source.txt');
    await fs.writeFile(supported, 'before');
    await fs.writeFile(unsupported, 'before');
    const transformedPaths: Array<string> = [];

    const { stdout } = await captureLog(async () => {
      const results = await runCodemod(
        makeCodemod({
          transformer: async (content, filename) => {
            transformedPaths.push(filename ?? '');
            return content.replace('before', 'after');
          },
        }),
        { paths: [directory], dry_run: true, log: false },
        { hooks: { targetFiltering: filename => filename !== 'source.txt' } },
      );

      expect(results).toHaveLength(1);
      expect(results[0]?.isOk()).toBe(true);
    });

    expect(transformedPaths).toEqual([supported]);
    expect(await fs.readFile(supported, 'utf8')).toBe('before');
    expect(await fs.readFile(unsupported, 'utf8')).toBe('before');
    expect(stdout).toBe('');
  });
});

test('returns an empty result for a filtered file and rejects missing targets with a useful error', async () => {
  await withTemporaryDirectory(async directory => {
    const unsupported = path.join(directory, 'source.txt');
    await fs.writeFile(unsupported, 'before');
    const codemod = makeCodemod();

    await expect(runCodemod(codemod, { paths: [unsupported] })).resolves.toEqual([]);
    await expect(runCodemod(codemod, { paths: [path.join(directory, 'missing.ts')] })).rejects.toThrow(
      "No file or directory found at '",
    );
  });
});

test('keeps unchanged files untouched and returns transformer failures as error results', async () => {
  await withTemporaryDirectory(async directory => {
    const unchanged = path.join(directory, 'unchanged.ts');
    const broken = path.join(directory, 'broken.ts');
    await fs.writeFile(unchanged, 'same');
    await fs.writeFile(broken, 'broken');
    const codemod = makeCodemod({
      transformer: async (content, filename) => {
        if (filename?.endsWith('broken.ts')) throw 'parse failed';
        return content;
      },
    });

    const { stdout } = await captureLog(async () => {
      const results = await runCodemod(codemod, { paths: [directory] });
      expect(results).toHaveLength(2);
      expect(results.filter(result => result.isOk())).toHaveLength(1);
      expect(results.filter(result => result.isErr())).toHaveLength(1);
    });

    expect(await fs.readFile(unchanged, 'utf8')).toBe('same');
    expect(stdout).include('targeting 2 files');
  });
});

test('uses default hooks and an empty language set to transform any file extension', async () => {
  await withTemporaryDirectory(async directory => {
    const source = path.join(directory, 'schema.custom');
    await fs.writeFile(source, 'before');
    const codemod = makeCodemod({ languages: [] });

    const results = await runCodemod(codemod, { paths: [source], log: false });

    expect(results).toHaveLength(1);
    expect(results[0]?.isOk()).toBe(true);
    expect(await fs.readFile(source, 'utf8')).toBe('after');
  });
});

test('honors the codemod target filter for both directories and single files', async () => {
  await withTemporaryDirectory(async directory => {
    const source = path.join(directory, 'skip.ts');
    await fs.writeFile(source, 'before');
    const codemod = makeCodemod({ targetFiltering: filename => filename !== 'skip.ts' });

    await expect(runCodemod(codemod, { paths: [directory], log: false })).resolves.toEqual([]);
    await expect(runCodemod(codemod, { paths: [source], log: false })).resolves.toEqual([]);
    expect(await fs.readFile(source, 'utf8')).toBe('before');
  });
});

test('deduplicates an explicitly repeated file path before transforming it', async () => {
  await withTemporaryDirectory(async directory => {
    const source = path.join(directory, 'source.ts');
    await fs.writeFile(source, 'before');
    const transformedContents: Array<string> = [];
    const codemod = makeCodemod({
      transformer: async content => {
        transformedContents.push(content);
        return content.replace('before', 'after');
      },
    });

    const results = await runCodemod(codemod, { paths: [source, source], log: false });

    expect(results).toHaveLength(1);
    expect(transformedContents).toEqual(['before']);
    expect(await fs.readFile(source, 'utf8')).toBe('after');
  });
});
