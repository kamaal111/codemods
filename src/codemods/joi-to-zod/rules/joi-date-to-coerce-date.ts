import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import { findIdentifierCallChains } from '../../utils/parse-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

const DATE_BOUNDS = new Set(['min', 'max', 'greater', 'less']);
const ZOD_BOUNDS: Record<string, string> = { min: 'min', max: 'max', greater: 'min', less: 'max' };

function coerceBoundArgument(args: string): string {
  const trimmed = args.trim();
  if (trimmed.length === 0) return trimmed;
  if (trimmed === "'now'" || trimmed === '"now"') return 'new Date()';

  const isStringLiteral = /^(['"]).*\1$/s.test(trimmed);
  const isNumberLiteral = /^-?\d+(\.\d+)?$/.test(trimmed);
  if (isStringLiteral || isNumberLiteral) return `new Date(${trimmed})`;

  return trimmed;
}

function rewriteDateChain(chainText: string, joiIdentifierName: string): string {
  for (const { segments } of findIdentifierCallChains(chainText, joiIdentifierName)) {
    const baseSegment = segments[0];
    if (baseSegment == null || baseSegment.name !== 'date' || baseSegment.args.trim().length > 0) continue;

    const rewritten = segments
      .slice(1)
      .filter(segment => DATE_BOUNDS.has(segment.name))
      .reverse()
      .reduce((accumulator, segment) => {
        const zodName = ZOD_BOUNDS[segment.name] ?? segment.name;
        const replacement = `.${zodName}(${coerceBoundArgument(segment.args)})`;

        return accumulator.slice(0, segment.startIndex) + replacement + accumulator.slice(segment.endIndex);
      }, chainText);

    return rewritten.slice(0, baseSegment.startIndex) + '.coerce.date()' + rewritten.slice(baseSegment.endIndex);
  }

  return chainText;
}

async function joiDateToCoerceDate(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const properties = getJoiProperties(root, { primitive: 'date' });
    return compactMap(properties, property => {
      const propertyText = property.text();
      const replacement = rewriteDateChain(propertyText, joiIdentifierName);
      if (replacement === propertyText) return undefined;

      return property.replace(replacement);
    });
  });
}

export default joiDateToCoerceDate;
