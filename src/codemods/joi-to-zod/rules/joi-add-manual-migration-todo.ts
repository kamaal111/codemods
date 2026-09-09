import type { Modifications } from '../../../kit/types.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

const UNSUPPORTED_VALIDATIONS = [
  {
    name: 'when',
    guidance:
      'switch/not/break conditions and conditionals outside an object property have no direct equivalent; use a discriminated union or an object-level superRefine',
  },
  {
    name: 'custom',
    guidance:
      'its callback needs Joi helpers beyond error and message, or is followed by calls a transform would remove; rewrite it as refine or superRefine',
  },
  {
    name: 'assert',
    guidance: 'its subject is not a plain reference; rewrite the cross-field assertion as superRefine',
  },
  {
    name: 'insensitive',
    guidance: 'Zod enums match case-sensitively; normalise the input with toLowerCase() before the enum instead',
  },
  { name: 'creditCard', guidance: 'Zod has no card check; add a refine running your own Luhn validation' },
  { name: 'truthy', guidance: 'Zod booleans do not coerce named values; use a preprocess or a union of literals' },
  { name: 'falsy', guidance: 'Zod booleans do not coerce named values; use a preprocess or a union of literals' },
  { name: 'empty', guidance: 'Zod has no empty-value sentinel; use a preprocess mapping the sentinel to undefined' },
  { name: 'strip', guidance: 'Zod keeps parsed keys; drop the key from the schema or transform it away afterwards' },
  {
    name: 'messages',
    guidance: 'Zod attaches messages per check rather than per schema; move each message onto its own check',
  },
  { name: 'link', guidance: 'a recursive reference is z.lazy(() => schema) in Zod' },
  {
    name: 'ordered',
    guidance: 'a Zod tuple has a fixed length, so it cannot carry the array length rules alongside it',
  },
  {
    name: 'single',
    guidance: 'Zod arrays reject a bare value; wrap the schema in a union with the item schema, or preprocess it',
  },
  {
    name: 'conditional',
    guidance: 'alternatives conditionals have no direct equivalent; use a discriminated union or superRefine',
  },
];

async function joiAddManualMigrationTodo(modifications: Modifications): Promise<Modifications> {
  return addManualMigrationTodos(modifications, 0);
}

async function addManualMigrationTodos(modifications: Modifications, validationIndex: number): Promise<Modifications> {
  const validation = UNSUPPORTED_VALIDATIONS[validationIndex];
  if (validation == null) {
    return modifications;
  }

  const { name, guidance } = validation;
  const properties = getJoiProperties(modifications.ast.root(), {
    primitive: '*',
    validationName: `${name}($ARGS)`,
  });
  const edits = properties.map(property => {
    return property.replace(`/* TODO(joi-to-zod): Manually migrate ${name}(); ${guidance}. */ ${property.text()}`);
  });
  const committed = await commitEditModifications(edits, modifications);

  return addManualMigrationTodos(committed, validationIndex + 1);
}

export default joiAddManualMigrationTodo;
