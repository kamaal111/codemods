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
];

async function joiAddManualMigrationTodo(modifications: Modifications): Promise<Modifications> {
  return addManualMigrationTodos(modifications, 0);
}

async function addManualMigrationTodos(modifications: Modifications, validationIndex: number): Promise<Modifications> {
  const validation = UNSUPPORTED_VALIDATIONS[validationIndex];
  if (validation == null) return modifications;

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
