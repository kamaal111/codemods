import assert from 'node:assert/strict';

import { parseAsync, type SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import { JOI_TO_ZOD_LANGUAGE } from '../../../../src/codemods/joi-to-zod';
import { getJoiCallChain, isOutermostCallChain } from '../../../../src/codemods/joi-to-zod/utils/get-joi-call-chain';

type AnyNode = SgNode<TypesMap, Kinds<TypesMap>>;

async function callExpressions(source: string): Promise<Array<AnyNode>> {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, source);

  return ast.root().findAll({ rule: { kind: 'call_expression' } });
}

async function firstCallExpression(source: string): Promise<AnyNode> {
  const [call] = await callExpressions(source);
  assert(call != null, `expected a call expression in ${source}`);

  return call;
}

async function outermostChainNames(source: string, joiName = 'Joi'): Promise<Array<string> | undefined> {
  const outermost = (await callExpressions(source)).find(node => isOutermostCallChain(node));
  if (outermost == null) {
    return undefined;
  }

  return getJoiCallChain(outermost, joiName)?.segments.map(segment => segment.name);
}

test('reads every segment of a chain', async () => {
  expect(await outermostChainNames('Joi.string().min(3).max(5).required();')).toEqual([
    'string',
    'min',
    'max',
    'required',
  ]);
});

test('reads a chain broken across lines', async () => {
  expect(await outermostChainNames('Joi.string()\n  .min(3)\n  .required();')).toEqual(['string', 'min', 'required']);
});

test('reads a chain whose links are spaced out', async () => {
  expect(await outermostChainNames('Joi . string () . min ( 3 );')).toEqual(['string', 'min']);
});

test('does not descend into a nested chain living in the arguments', async () => {
  expect(await outermostChainNames('Joi.object().keys({ a: Joi.string().min(1) }).required();')).toEqual([
    'object',
    'keys',
    'required',
  ]);
});

test('keeps segment arguments verbatim', async () => {
  const outermost = await firstCallExpression('Joi.object().keys({ a: Joi.string() });');
  const keysSegment = getJoiCallChain(outermost, 'Joi')?.segments[1];

  expect(keysSegment?.arguments.map(argument => argument.text())).toEqual(['{ a: Joi.string() }']);
});

test('keeps delimiters inside strings and regexes within one argument', async () => {
  const outermost = await firstCallExpression(String.raw`Joi.string().pattern(/[()]/).default(')');`);
  const segments = getJoiCallChain(outermost, 'Joi')?.segments ?? [];

  expect(segments.map(segment => segment.arguments.map(argument => argument.text()).join(', '))).toEqual([
    '',
    '/[()]/',
    "')'",
  ]);
});

test('leaves comments out of the arguments', async () => {
  const outermost = await firstCallExpression("Joi.string().valid(/* every role */ 'admin', 'user');");
  const validSegment = getJoiCallChain(outermost, 'Joi')?.segments[1];

  expect(validSegment?.arguments.map(argument => argument.text())).toEqual(["'admin'", "'user'"]);
});

test('spans a segment from the end of its receiver to the end of its call', async () => {
  const source = 'Joi.string().min(3);';
  const outermost = await firstCallExpression(source);
  const minSegment = getJoiCallChain(outermost, 'Joi')?.segments[1];

  expect(source.slice(minSegment?.receiver.range().end.index, minSegment?.call.range().end.index)).toBe('.min(3)');
});

test('stops at a property access that is not called', async () => {
  expect(await outermostChainNames('Joi.string().min(3).description;')).toEqual(['string', 'min']);
});

test('reads what it can from an unbalanced chain', async () => {
  expect(await outermostChainNames('Joi.string().min(3')).toEqual(['string']);
});

test.each([
  ['an identifier that merely ends in the joi name', 'myJoi.string();'],
  ['an identifier that merely starts with the joi name', 'Joimon.string();'],
  ['a joi name reached through a namespace', 'namespace.Joi.string();'],
])('does not claim a chain rooted at %s', async (_name, source) => {
  const call = await firstCallExpression(source);

  expect(getJoiCallChain(call, 'Joi')).toBeUndefined();
});

test('claims the chain when the root really is the joi binding', async () => {
  const call = await firstCallExpression('Joi.string();');

  expect(getJoiCallChain(call, 'Joi')?.root.text()).toBe('Joi');
});

test('follows the local name the joi import was given', async () => {
  expect(await outermostChainNames('Validator.string().required();', 'Validator')).toEqual(['string', 'required']);
});

test('reads no chain from a node that is not a call', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, 'const schema = Joi;');
  const identifier = ast.root().find({ rule: { kind: 'identifier', regex: '^Joi$' } });
  assert(identifier != null, 'expected to find the Joi identifier');

  expect(getJoiCallChain(identifier, 'Joi')).toBeUndefined();
});

test('marks only the last call of a chain as outermost', async () => {
  const calls = await callExpressions('Joi.string().min(3).required();');

  expect(calls.map(call => [call.text(), isOutermostCallChain(call)])).toEqual([
    ['Joi.string().min(3).required()', true],
    ['Joi.string().min(3)', false],
    ['Joi.string()', false],
  ]);
});

test('marks a chain nested in an argument as outermost in its own right', async () => {
  const calls = await callExpressions('Joi.object().keys({ a: Joi.string().min(1) });');
  const nested = calls.find(call => call.text() === 'Joi.string().min(1)');

  expect(nested == null ? undefined : isOutermostCallChain(nested)).toBe(true);
});
