#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import prettier from 'prettier';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

const name = process.argv[2];
if (name == null || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
  fail('Usage: yarn new:codemod <kebab-case-name>');
}

const camelCase = name.replaceAll(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase());
const screamingCase = name.replaceAll('-', '_').toUpperCase();
const pascalCase = camelCase.charAt(0).toUpperCase() + camelCase.slice(1);

async function format(source: string, filepath: string): Promise<string> {
  const options = await prettier.resolveConfig(filepath);

  return prettier.format(source, { ...options, filepath });
}

const codemodDirectory = path.join(repositoryRoot, 'src/codemods', name);
const testDirectory = path.join(repositoryRoot, 'test/codemods', name);
const documentationPath = path.join(repositoryRoot, 'docs', `${name}.md`);

if (
  await fs.stat(codemodDirectory).then(
    () => true,
    () => false,
  )
) {
  fail(`src/codemods/${name} already exists.`);
}

const indexSource = `import { Lang, parseAsync, type SgRoot } from '@ast-grep/napi';
import type { TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import type { Codemod, Modifications } from '../../kit/types.ts';

export const ${screamingCase}_LANGUAGE = Lang.TypeScript;

export function make${pascalCase}InitialModification(
  ast: SgRoot<TypesMap>,
  filename?: string,
): Modifications {
  return { lang: ${screamingCase}_LANGUAGE, report: { changesApplied: 0 }, ast, filename, history: [ast] };
}

export function ${camelCase}Modifications(modifications: Modifications): Promise<Modifications> {
  // Chain your rules here: \`return firstRule(modifications).then(secondRule);\`
  return Promise.resolve(modifications);
}

async function ${camelCase}(content: string, filename?: string): Promise<string> {
  const ast = await parseAsync(${screamingCase}_LANGUAGE, content);

  return ${camelCase}Modifications(make${pascalCase}InitialModification(ast, filename)).then(
    modifications => modifications.ast.root().text(),
  );
}

export async function ${camelCase}Transformer(content: string, filename?: string): Promise<Modifications> {
  const ast = await parseAsync(${screamingCase}_LANGUAGE, content);

  return ${camelCase}Modifications(make${pascalCase}InitialModification(ast, filename));
}

export const ${screamingCase}_CODEMOD: Codemod = {
  name: '${name}',
  languages: [${screamingCase}_LANGUAGE],
  transformer: ${camelCase},
};

export default ${camelCase};
`;

const testSource = `import ${camelCase} from '../../../src/codemods/${name}/index.ts';

describe('${name}', () => {
  it('transforms nothing yet', async () => {
    const source = 'const value = 42;\\n';

    await expect(${camelCase}(source)).resolves.toBe(source);
  });
});
`;

const documentationSource = `# ${name}

TODO: one line describing what this codemod rewrites.

\`\`\`bash
codemods ${name} ./src
\`\`\`

See the [README](../README.md) for CLI flags, config files, and the rest of the collection.

TODO: describe which files the codemod targets, and what it leaves alone.

## What it transforms

TODO: list the rewrites, grouped so a reader can find the one they care about.

## Example

TODO: a before and after that shows the codemod earning its keep.

The codemod does not format its output. Run your formatter over the changed files afterwards.

## Current constraints

TODO: what it deliberately does not handle, and what needs a manual migration.

## Library usage

TODO: document the exports once they are wired into \`src/index.ts\`.
`;

await fs.mkdir(path.join(codemodDirectory, 'rules'), { recursive: true });
await fs.mkdir(path.dirname(documentationPath), { recursive: true });
await fs.mkdir(testDirectory, { recursive: true });
const indexPath = path.join(codemodDirectory, 'index.ts');
await fs.writeFile(indexPath, await format(indexSource, indexPath));
await fs.writeFile(path.join(codemodDirectory, 'rules/.gitkeep'), '');
const testPath = path.join(testDirectory, 'index.test.ts');
await fs.writeFile(testPath, await format(testSource, testPath));
await fs.writeFile(documentationPath, await format(documentationSource, documentationPath));

console.log(`✅ created src/codemods/${name}/, test/codemods/${name}/ and docs/${name}.md

Register it by adding this entry to src/codemods/registry.ts:

  import { ${screamingCase}_CODEMOD } from './${name}/index.ts';

  '${name}': {
    codemod: ${screamingCase}_CODEMOD,
    summary: 'TODO: one line describing what this codemod rewrites',
  },

Then add a row for it to the 'Available codemods' table in README.md, linking to docs/${name}.md.
`);
