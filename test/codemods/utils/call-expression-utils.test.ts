import { parseAsync } from '@ast-grep/napi';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../src/codemods/joi-to-zod';
import commitEditModifications from '../../../src/codemods/utils/commit-edit-modifications';
import extractArgsFromCallExpression from '../../../src/codemods/utils/extract-args-from-call-expression';
import extractNameFromCallExpression from '../../../src/codemods/utils/extract-name-from-call-expression';
import traverseUp from '../../../src/codemods/utils/traverse-up';

test.each([
  ['required()', 'required'],
  ['pattern($ARGS)', 'pattern'],
  ['bare', 'bare'],
])('extracts the name from %s', (input, expected) => {
  expect(extractNameFromCallExpression(input)).toBe(expected);
});

test('returns undefined extracting a name from nothing', () => {
  expect(extractNameFromCallExpression(undefined)).toBeUndefined();
});

test.each([
  ['required()', ''],
  ['allow(null)', 'null'],
  ['pattern(/^a/, { invert: true })', '/^a/, { invert: true }'],
])('extracts the arguments from %s', (input, expected) => {
  expect(extractArgsFromCallExpression(input)).toBe(expected);
});

test.each([[undefined], ['bare']])('returns undefined extracting arguments from %s', input => {
  expect(extractArgsFromCallExpression(input)).toBeUndefined();
});

test('walks up to a matching ancestor', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, 'const schema = Joi.string().min(3);');
  const [identifier] = ast.root().findAll({ rule: { kind: 'property_identifier' } });
  if (identifier == null) throw new Error('expected a property identifier');

  const callExpression = traverseUp(identifier, node => node.kind() === 'call_expression');

  expect(callExpression?.text()).contain('Joi.string()');
});

test('returns undefined when no ancestor matches', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, 'const value = 1;');
  const root = ast.root();

  expect(traverseUp(root, node => node.kind() === 'call_expression')).toBeUndefined();
});

test('returns the modifications untouched when there are no edits', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, 'const value = 1;');
  const modifications = makeJoiToZodInitialModification(ast);
  const committed = await commitEditModifications([], modifications);

  expect(committed).toBe(modifications);
  expect(committed.report.changesApplied).toBe(0);
});

test('counts committed edits and records history', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, 'const value = 1;');
  const modifications = makeJoiToZodInitialModification(ast);
  const [numberNode] = ast.root().findAll({ rule: { kind: 'number' } });
  if (numberNode == null) throw new Error('expected a number literal');

  const committed = await commitEditModifications([numberNode.replace('2')], modifications);

  expect(committed.report.changesApplied).toBe(1);
  expect(committed.history).toHaveLength(2);
  expect(committed.ast.root().text()).contain('const value = 2;');
});
