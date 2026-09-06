import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import extractArgsFromCallExpression from '../../utils/extract-args-from-call-expression.ts';
import extractNameFromCallExpression from '../../utils/extract-name-from-call-expression.ts';
import traverseUp from '../../utils/traverse-up.ts';
import type { JoiPrimitives } from '../types.ts';
import getJoiIdentifierName from './get-joi-identifier-name.ts';

function getJoiProperties(
  root: SgNode<TypesMap, Kinds<TypesMap>>,
  params: { primitive?: JoiPrimitives; validationName?: string },
): Array<SgNode<TypesMap, Kinds<TypesMap>>> {
  const joiImportIdentifierName = getJoiIdentifierName(root);
  if (joiImportIdentifierName == null) return [];

  let propertyIdentifiers = root.findAll({ rule: { kind: 'property_identifier' } });
  if (propertyIdentifiers.length === 0) return [];

  const validationName = extractNameFromCallExpression(params.validationName);
  const validationArgs = extractArgsFromCallExpression(params.validationName);
  const validationArgsIsMeta = validationArgs?.includes('$') ?? false;
  if (validationName != null) {
    propertyIdentifiers = propertyIdentifiers.filter(propertyIdentifier => {
      const sameSignature =
        traverseUp(propertyIdentifier, node => node.kind() === 'call_expression')
          ?.text()
          .split('.')
          .reverse()
          .find(transformation => {
            if (extractNameFromCallExpression(transformation) !== validationName) return false;

            const transformationArgs = extractArgsFromCallExpression(transformation);
            if (transformationArgs == null && validationArgs == null) return true;

            const transformationArgsIsMeta = transformationArgs?.includes('$') ?? false;
            if (transformationArgsIsMeta || validationArgsIsMeta) return true;

            return true;
          }) != null;

      return propertyIdentifier.text() === validationName && sameSignature;
    });
  }

  return propertyIdentifiers.reduce<{ results: Array<SgNode<TypesMap, Kinds<TypesMap>>>; checkedIn: Set<string> }>(
    (acc, propertyIdentifier) => {
      const callExpression = traverseUp(propertyIdentifier, node => node.kind() === 'call_expression');
      if (callExpression == null) return acc;

      let schemaCallExpression = callExpression;
      while (schemaCallExpression.parent()?.kind() === 'member_expression') {
        const nextCallExpression = schemaCallExpression.parent()?.parent();
        if (nextCallExpression?.kind() !== 'call_expression') break;

        schemaCallExpression = nextCallExpression;
      }

      const callExpressionText = schemaCallExpression.text();
      if (!callExpressionText.startsWith(joiImportIdentifierName)) return acc;
      if (
        params.primitive != null &&
        params.primitive !== '*' &&
        !callExpressionText.includes(`.${params.primitive}(`)
      ) {
        return acc;
      }
      const range = schemaCallExpression.range();
      const rangeKey = `${range.start.index}:${range.end.index}`;
      if (acc.checkedIn.has(rangeKey)) return acc;

      acc.results.push(schemaCallExpression);
      acc.checkedIn.add(rangeKey);

      return acc;
    },
    { results: [], checkedIn: new Set([]) },
  ).results;
}

export default getJoiProperties;
