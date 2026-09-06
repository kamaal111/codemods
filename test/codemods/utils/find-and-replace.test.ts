import { parseAsync } from '@ast-grep/napi';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../src/codemods/joi-to-zod';
import { findAndReplaceConfigModifications, findAndReplaceEdits } from '../../../src/codemods/utils/find-and-replace';

async function modificationsOf(source: string) {
  return makeJoiToZodInitialModification(await parseAsync(JOI_TO_ZOD_LANGUAGE, source));
}

test('replaces matches with a plain string transformer', async () => {
  const modifications = await modificationsOf('jest.fn();');

  const replaced = await findAndReplaceConfigModifications(modifications, [
    { rule: { pattern: 'jest.fn()' }, transformer: 'vi.fn()' },
  ]);

  expect(replaced.ast.root().text()).toBe('vi.fn();');
  expect(replaced.report.changesApplied).toBe(1);
  expect(replaced.history).toHaveLength(2);
});

test('fills meta variables into a returned replacement string', async () => {
  const modifications = await modificationsOf("jest.mock('fs');");

  const replaced = await findAndReplaceConfigModifications(modifications, [
    { rule: { pattern: 'jest.mock($PATH)' }, transformer: () => 'vi.mock($PATH)' },
  ]);

  expect(replaced.ast.root().text()).toBe("vi.mock('fs');");
});

test('fills multi meta variables into a returned replacement string', async () => {
  const modifications = await modificationsOf('call(one, two);');

  const replaced = await findAndReplaceConfigModifications(modifications, [
    { rule: { pattern: 'call($$$ARGS)' }, transformer: () => 'replaced($$$ARGS)' },
  ]);

  expect(replaced.ast.root().text()).toBe('replaced(one, two);');
});

test('applies config entries in order, so later entries see earlier edits', async () => {
  const modifications = await modificationsOf('first();');

  const replaced = await findAndReplaceConfigModifications(modifications, [
    { rule: { pattern: 'first()' }, transformer: 'second()' },
    { rule: { pattern: 'second()' }, transformer: 'third()' },
  ]);

  expect(replaced.ast.root().text()).toBe('third();');
  expect(replaced.report.changesApplied).toBe(2);
});

test('accepts edits returned directly from a transformer', async () => {
  const modifications = await modificationsOf('const value = 1;');

  const replaced = await findAndReplaceConfigModifications(modifications, [
    { rule: { kind: 'number' }, transformer: node => node.replace('2') },
  ]);

  expect(replaced.ast.root().text()).toBe('const value = 2;');
});

test('accepts an array mixing edits and replacement strings', async () => {
  const modifications = await modificationsOf('const value = 1;\nconst other = 3;');

  const replaced = await findAndReplaceConfigModifications(modifications, [
    { rule: { pattern: '1' }, transformer: node => [node.replace('2'), '9'] },
  ]);

  expect(replaced.report.changesApplied).toBe(2);
});

test('skips nodes whose transformer returns undefined', async () => {
  const modifications = await modificationsOf('jest.fn();');

  const replaced = await findAndReplaceConfigModifications(modifications, [
    { rule: { pattern: 'jest.fn()' }, transformer: () => undefined },
  ]);

  expect(replaced).toBe(modifications);
});

test('skips replacements identical to the matched source', async () => {
  const modifications = await modificationsOf('jest.fn();');

  const replaced = await findAndReplaceConfigModifications(modifications, [
    { rule: { pattern: 'jest.fn()' }, transformer: 'jest.fn()' },
  ]);

  expect(replaced).toBe(modifications);
});

test('binds a repeated meta variable to a single value', async () => {
  const modifications = await modificationsOf('same(one, one);');

  const replaced = await findAndReplaceConfigModifications(modifications, [
    { rule: { pattern: 'same($A, $A)' }, transformer: () => 'replaced($A)' },
  ]);

  expect(replaced.ast.root().text()).toBe('replaced(one);');
});

test('leaves a replacement untouched when the rule has no pattern to read meta variables from', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, 'const value = 1;');

  const edits = findAndReplaceEdits(ast, { kind: 'number' }, '$UNKNOWN');

  expect(edits).toHaveLength(1);
});

test('leaves meta variables unresolved when the pattern cannot be matched back against the node text', async () => {
  // ast-grep matches across the line break, but the reconstructed regex cannot, so there is
  // nothing to substitute and the replacement is emitted as written.
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, 'call(\n  one,\n);');

  const edits = findAndReplaceEdits(ast, { pattern: 'call($$$ARGS)' }, 'replaced($$$ARGS)');

  expect(ast.root().commitEdits(edits)).toBe('replaced($$$ARGS);');
});
