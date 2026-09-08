import assert from 'node:assert/strict';

import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

const JOI_IMPORT_META_IDENTIFIER = 'J';
const MODULE_IDENTIFIER = 'MODULE';
const NAMED_IMPORTS_IDENTIFIER = 'REST';
const JOI_MODULE_SPECIFIERS = new Set(["'joi'", '"joi"']);

const IMPORT_PATTERNS = [
  `import $${JOI_IMPORT_META_IDENTIFIER}, { $$$${NAMED_IMPORTS_IDENTIFIER} } from $${MODULE_IDENTIFIER}`,
  `import { default as $${JOI_IMPORT_META_IDENTIFIER}, $$$${NAMED_IMPORTS_IDENTIFIER} } from $${MODULE_IDENTIFIER}`,
  `import { $$$${NAMED_IMPORTS_IDENTIFIER}, default as $${JOI_IMPORT_META_IDENTIFIER} } from $${MODULE_IDENTIFIER}`,
  `import $${JOI_IMPORT_META_IDENTIFIER} from $${MODULE_IDENTIFIER}`,
];

function getJoiImport(root: SgNode<TypesMap, Kinds<TypesMap>>): SgNode<TypesMap, Kinds<TypesMap>> | undefined {
  for (const pattern of IMPORT_PATTERNS) {
    for (const node of root.findAll(pattern)) {
      const moduleSpecifier = node.getMatch(MODULE_IDENTIFIER);
      assert(moduleSpecifier != null, `$${MODULE_IDENTIFIER} is captured by every import pattern`);

      if (!JOI_MODULE_SPECIFIERS.has(moduleSpecifier.text())) continue;

      return node;
    }
  }
}

export function getJoiImportWithMeta(root: SgNode<TypesMap, Kinds<TypesMap>>):
  | {
      importNode: SgNode<TypesMap, Kinds<TypesMap>>;
      identifier: SgNode<TypesMap, Kinds<TypesMap>>;
      module: SgNode<TypesMap, Kinds<TypesMap>>;
      namedImports: SgNode<TypesMap, Kinds<TypesMap>>[];
    }
  | undefined {
  const importNode = getJoiImport(root);
  if (importNode == null) return undefined;

  const identifier = importNode.getMatch(JOI_IMPORT_META_IDENTIFIER);
  assert(identifier != null, 'If joi import node is found then it must have an identifier too');

  const module = importNode.getMatch(MODULE_IDENTIFIER);
  assert(module != null, 'If joi import node is found then it must have an module too');

  const namedImports = importNode.getMultipleMatches(NAMED_IMPORTS_IDENTIFIER).filter(node => node.isNamed());

  return { importNode, identifier, module, namedImports };
}

export function getJoiImportIdentifierFromJoiImport(root: SgNode<TypesMap, Kinds<TypesMap>>): string | undefined {
  return getJoiImportWithMeta(root)?.identifier.text();
}

export default getJoiImport;
