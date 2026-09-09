import type { Modifications } from '../../../kit/types.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import { JOI_PRIMITIVES, type JoiPrimitives } from '../types.ts';
import replaceJoiValidationWithZodEdits from '../utils/replace-joi-validation-with-zod-edits.ts';

type JoiValidationMapping = {
  primitive: JoiPrimitives;
  joi: string;
  zod: string | undefined;
};

type JoiValidationDefinition = { joi: string; zod: string | undefined };
type JoiValidationDefinitions = { [Primitive in JoiPrimitives]: Array<JoiValidationDefinition> };

const JOI_VALIDATIONS_TO_ZOD_VALIDATION_MAPPING = {
  string: [
    { joi: 'alphanum()', zod: 'regex(/^[a-zA-Z0-9]+$/)' },
    { joi: 'lowercase()', zod: 'toLowerCase()' },
    { joi: 'uppercase()', zod: 'toUpperCase()' },
    { joi: 'token()', zod: 'regex(/^\\w+$/)' },
    { joi: 'pattern($ARGS)', zod: 'regex($ARGS)' },
    { joi: "allow('')", zod: undefined },
    { joi: "case('lower')", zod: 'toLowerCase()' },
    { joi: "case('upper')", zod: 'toUpperCase()' },
    { joi: 'ip()', zod: 'refine(value => z.ipv4().safeParse(value).success || z.ipv6().safeParse(value).success)' },
    { joi: 'truncate()', zod: undefined },
    { joi: 'normalize()', zod: 'transform(value => value.normalize())' },
    { joi: 'replace($ARGS)', zod: 'transform(value => value.replace($ARGS))' },
  ],
  '*': [
    { joi: 'exist()', zod: 'required()' },
    { joi: 'equal($ARGS)', zod: 'valid($ARGS)' },
    { joi: 'not($ARGS)', zod: 'invalid($ARGS)' },
    { joi: 'description($ARGS)', zod: 'describe($ARGS)' },
    { joi: 'label($ARGS)', zod: 'describe($ARGS)' },
    { joi: 'allow(null)', zod: 'nullable()' },
    { joi: 'required(false)', zod: 'optional()' },
    { joi: 'unknown(true)', zod: 'passthrough()' },
    { joi: 'unknown(false)', zod: 'strict()' },
    { joi: 'unknown()', zod: 'passthrough()' },
    { joi: 'bool()', zod: 'boolean()' },
    { joi: 'failover($ARGS)', zod: 'catch($ARGS)' },
    { joi: 'func()', zod: 'function()' },
    { joi: 'invalid($ARGS)', zod: 'refine(value => ![$ARGS].includes(value))' },
    { joi: 'disallow($ARGS)', zod: 'refine(value => ![$ARGS].includes(value))' },
    { joi: 'raw()', zod: undefined },
    { joi: 'cast($ARGS)', zod: undefined },
    { joi: 'meta($ARGS)', zod: undefined },
    { joi: 'tag($ARGS)', zod: undefined },
    { joi: 'note($ARGS)', zod: undefined },
    { joi: 'example($ARGS)', zod: undefined },
    { joi: 'prefs($ARGS)', zod: undefined },
    { joi: 'options($ARGS)', zod: undefined },
    { joi: 'preferences($ARGS)', zod: undefined },
  ],
  number: [
    { joi: 'integer()', zod: 'int()' },
    { joi: 'greater($ARGS)', zod: 'gt($ARGS)' },
    { joi: 'less($ARGS)', zod: 'lt($ARGS)' },
    { joi: 'precision($ARGS)', zod: 'transform(value => Number(value.toFixed($ARGS)))' },
    { joi: 'multiple($ARGS)', zod: 'multipleOf($ARGS)' },
    { joi: 'port()', zod: 'int().min(0).max(65535)' },
    { joi: "sign('positive')", zod: 'positive()' },
    { joi: "sign('negative')", zod: 'negative()' },
    { joi: 'unsafe()', zod: undefined },
  ],
  array: [
    { joi: 'unique()', zod: 'refine(value => new Set(value).size === value.length)' },
    { joi: 'sparse(false)', zod: 'refine(value => value.every(item => item != null))' },
    { joi: 'sparse()', zod: 'refine(value => value.every(item => item != null))' },
  ],
  date: [
    { joi: 'iso()', zod: undefined },
    { joi: 'timestamp()', zod: undefined },
  ],
  object: [
    { joi: 'append($ARGS)', zod: 'extend($ARGS)' },
    { joi: 'min($ARGS)', zod: 'refine(value => Object.keys(value).length >= $ARGS)' },
    { joi: 'max($ARGS)', zod: 'refine(value => Object.keys(value).length <= $ARGS)' },
    { joi: 'length($ARGS)', zod: 'refine(value => Object.keys(value).length === $ARGS)' },
  ],
  boolean: [{ joi: 'sensitive()', zod: undefined }],
} satisfies JoiValidationDefinitions;

async function joiValidationsToZodValidations(modifications: Modifications): Promise<Modifications> {
  const mappings = JOI_PRIMITIVES.flatMap(primitive =>
    JOI_VALIDATIONS_TO_ZOD_VALIDATION_MAPPING[primitive].map(({ joi, zod }) => ({ primitive, joi, zod })),
  );

  return replaceValidations(modifications, mappings, 0);
}

async function replaceValidations(
  modifications: Modifications,
  mappings: Array<JoiValidationMapping>,
  mappingIndex: number,
): Promise<Modifications> {
  const mapping = mappings[mappingIndex];
  if (mapping == null) {
    return modifications;
  }

  const updated = await replaceValidation(modifications, mapping);

  return replaceValidations(updated, mappings, mappingIndex + 1);
}

async function replaceValidation(
  modifications: Modifications,
  { primitive, joi, zod }: JoiValidationMapping,
): Promise<Modifications> {
  const edits = replaceJoiValidationWithZodEdits(modifications.ast.root(), {
    primitive,
    validationTargetKey: joi,
    zodValidation: zod,
  });
  const updated = await commitEditModifications(edits, modifications);
  const isUnchanged = updated.ast.root().text() === modifications.ast.root().text();
  if (isUnchanged) {
    return modifications;
  }

  return replaceValidation(updated, { primitive, joi, zod });
}

export default joiValidationsToZodValidations;
