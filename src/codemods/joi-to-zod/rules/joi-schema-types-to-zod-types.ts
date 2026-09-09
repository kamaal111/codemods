import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import { findRecordValue } from '../../../utils/objects.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

const ZOD_TYPE = 'z.ZodType';
const SCHEMA_TYPE_TO_ZOD_TYPE = {
  Schema: ZOD_TYPE,
  SchemaLike: ZOD_TYPE,
  AnySchema: ZOD_TYPE,
  AlternativesSchema: ZOD_TYPE,
  ArraySchema: ZOD_TYPE,
  BinarySchema: ZOD_TYPE,
  BooleanSchema: ZOD_TYPE,
  DateSchema: ZOD_TYPE,
  FunctionSchema: ZOD_TYPE,
  LinkSchema: ZOD_TYPE,
  NumberSchema: ZOD_TYPE,
  ObjectSchema: ZOD_TYPE,
  StringSchema: ZOD_TYPE,
  SymbolSchema: ZOD_TYPE,
  SchemaMap: 'z.ZodRawShape',
  PartialSchemaMap: 'z.ZodRawShape',
} satisfies Record<string, string>;

async function joiSchemaTypesToZodTypes(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiImportIdentifierName = getJoiIdentifierName(root);
  if (joiImportIdentifierName == null) {
    return modifications;
  }

  const edits = compactMap(root.findAll({ rule: { kind: 'nested_type_identifier' } }), node => {
    const [qualifier, name, ...rest] = node.text().split('.');
    if (qualifier !== joiImportIdentifierName || name == null || rest.length > 0) {
      return undefined;
    }

    const zodType = findRecordValue(SCHEMA_TYPE_TO_ZOD_TYPE, name);
    if (zodType == null) {
      return undefined;
    }

    const parent = node.parent();
    if (parent?.kind() !== 'generic_type') {
      return node.replace(zodType);
    }

    return parent.replace(`${zodType}${parent.child(1)?.text() ?? ''}`);
  });

  return commitEditModifications(edits, modifications);
}

export default joiSchemaTypesToZodTypes;
