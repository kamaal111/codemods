import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiPrimitive from '../utils/get-joi-primitive.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

const ARGS_META_IDENTIFIER = 'ARGS';
const CHAIN_META_IDENTIFIER = 'CHAIN';
const ENUM_VALUES_PATTERN = /^\.\.\.\s*Object\.values\(\s*([$_\p{ID_Start}][$_\p{ID_Continue}]*)\s*\)$/u;

function getEnumIdentifierFromSpread(argsText: string): string | undefined {
  return ENUM_VALUES_PATTERN.exec(argsText)?.[1];
}

async function joiCheckToEnum(modifications: Modifications): Promise<Modifications> {
  const joiImportIdentifierName = getJoiIdentifierName(modifications.ast.root());
  if (joiImportIdentifierName == null) {
    return modifications;
  }

  return convertChecksToEnums(modifications, joiImportIdentifierName);
}

async function convertChecksToEnums(
  modifications: Modifications,
  joiImportIdentifierName: string,
): Promise<Modifications> {
  const properties = getJoiProperties(modifications.ast.root(), { primitive: '*', validationName: 'valid($ARGS)' });
  const edits = compactMap(properties, property => {
    const primitive = getJoiPrimitive(property, joiImportIdentifierName);
    if (primitive == null) {
      return null;
    }

    const validCallNode = property.find({
      rule: { pattern: `$${CHAIN_META_IDENTIFIER}.valid($$$${ARGS_META_IDENTIFIER})` },
    });
    if (validCallNode == null) {
      return null;
    }

    const chainNode = validCallNode.getMatch(CHAIN_META_IDENTIFIER);
    if (chainNode == null) {
      return null;
    }

    const argNodes = validCallNode
      .getMultipleMatches(ARGS_META_IDENTIFIER)
      .filter(node => node.isNamed() && node.kind() !== 'comment');
    const argsText = argNodes.map(n => n.text()).join(', ');
    if (primitive !== 'string') {
      const [firstLiteral, ...restLiterals] = argNodes.map(
        node => `${joiImportIdentifierName}.literal(${node.text()})`,
      );
      if (firstLiteral == null) {
        return null;
      }

      const replacement =
        restLiterals.length === 0
          ? firstLiteral
          : `${joiImportIdentifierName}.union([${[firstLiteral, ...restLiterals].join(', ')}])`;

      return validCallNode.replace(replacement);
    }

    const [singleArgNode] = argNodes;
    const spreadArgNode =
      argNodes.length === 1 && singleArgNode?.kind() === 'spread_element' ? singleArgNode : undefined;
    if (spreadArgNode != null) {
      const enumIdentifier = getEnumIdentifierFromSpread(spreadArgNode.text());
      if (enumIdentifier != null) {
        return validCallNode.replace(`${chainNode.text()}.enum(${enumIdentifier})`);
      }

      const spreadExpression = spreadArgNode.namedChildren().find(node => node.kind() !== 'comment');
      if (spreadExpression != null) {
        return validCallNode.replace(`${chainNode.text()}.enum(${spreadExpression.text()})`);
      }
    }

    return validCallNode.replace(`${chainNode.text()}.enum([${argsText}])`);
  });
  const updated = await commitEditModifications(edits, modifications);
  const isUnchanged = updated.ast.root().text() === modifications.ast.root().text();
  if (isUnchanged) {
    return modifications;
  }

  return convertChecksToEnums(updated, joiImportIdentifierName);
}

export default joiCheckToEnum;
