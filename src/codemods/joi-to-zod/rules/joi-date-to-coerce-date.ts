import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import { findRecordValue } from '../../../utils/objects.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import type { JoiNode } from '../utils/get-joi-call-chain.ts';
import { getJoiCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

const DATE_BOUNDS = new Set(['min', 'max', 'greater', 'less']);
const ZOD_BOUNDS = { min: 'min', max: 'max', greater: 'min', less: 'max' } satisfies Record<string, string>;

function coerceBoundArgument(args: string): string {
  const trimmed = args.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  if (trimmed === "'now'" || trimmed === '"now"') {
    return 'new Date()';
  }

  const isStringLiteral = /^(['"]).*\1$/s.test(trimmed);
  const isNumberLiteral = /^-?\d+(\.\d+)?$/.test(trimmed);
  if (isStringLiteral || isNumberLiteral) {
    return `new Date(${trimmed})`;
  }

  return trimmed;
}

function rewriteDateChain(node: JoiNode, joiIdentifierName: string): string | undefined {
  const chain = getJoiCallChain(node, joiIdentifierName);
  const baseSegment = chain?.segments[0];
  if (chain == null || baseSegment?.name !== 'date' || baseSegment.arguments.length > 0) {
    return undefined;
  }

  const offset = node.range().start.index;
  const rewritten = chain.segments
    .slice(1)
    .filter(segment => DATE_BOUNDS.has(segment.name))
    .reverse()
    .reduce((accumulator, segment) => {
      const zodName = findRecordValue(ZOD_BOUNDS, segment.name) ?? segment.name;
      const args = segment.arguments.map(argument => argument.text()).join(', ');

      return (
        accumulator.slice(0, segment.receiver.range().end.index - offset) +
        `.${zodName}(${coerceBoundArgument(args)})` +
        accumulator.slice(segment.call.range().end.index - offset)
      );
    }, node.text());

  return (
    rewritten.slice(0, baseSegment.call.range().start.index - offset) +
    `${joiIdentifierName}.coerce.date()` +
    rewritten.slice(baseSegment.call.range().end.index - offset)
  );
}

async function joiDateToCoerceDate(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) {
      return [];
    }

    const properties = getJoiProperties(root, { primitive: 'date' });
    return compactMap(properties, property => {
      const replacement = rewriteDateChain(property, joiIdentifierName);
      if (replacement == null || replacement === property.text()) {
        return undefined;
      }

      return property.replace(replacement);
    });
  });
}

export default joiDateToCoerceDate;
