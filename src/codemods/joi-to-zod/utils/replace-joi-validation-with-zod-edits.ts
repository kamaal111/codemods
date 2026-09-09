import type { Edit, SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import { compactMap } from '../../../utils/arrays.ts';
import extractArgsFromCallExpression from '../../utils/extract-args-from-call-expression.ts';
import extractNameFromCallExpression from '../../utils/extract-name-from-call-expression.ts';
import scanCallArguments from '../../utils/scan-call-arguments.ts';
import splitArguments from '../../utils/split-arguments.ts';
import type { JoiPrimitives } from '../types.ts';
import getJoiIdentifierName from './get-joi-identifier-name.ts';
import getJoiProperties from './get-joi-properties.ts';

function substituteMetaArguments(zodValidation: string, metaSpecification: string, foundArguments: string): string {
  const metaTokens = splitArguments(metaSpecification)
    .map(token => token.trim())
    .filter(token => token.startsWith('$'));
  if (metaTokens.length === 0) {
    return zodValidation;
  }

  const [singleToken] = metaTokens;
  const isSingleWholeToken = singleToken != null && metaTokens.length === 1 && metaSpecification.trim() === singleToken;
  if (isSingleWholeToken) {
    return zodValidation.replaceAll(singleToken, foundArguments);
  }

  const foundArgumentsComponents = splitArguments(foundArguments).map(argument => argument.trim());

  return metaTokens.reduce((accumulator, token, index) => {
    const foundArgument = foundArgumentsComponents[index];
    if (foundArgument == null) {
      return accumulator;
    }

    return accumulator.replaceAll(token, foundArgument);
  }, zodValidation);
}

function normalizeArguments(args: string): string {
  return splitArguments(args)
    .map(argument => argument.trim())
    .join(',');
}

function rewriteChain(
  chainText: string,
  params: {
    validationName: string;
    validationArgs: string;
    validationArgsIsMeta: boolean;
    zodValidation: string | undefined;
    joiIdentifierName: string;
  },
): string {
  const expectedArgs = normalizeArguments(params.validationArgs);

  let result = chainText;
  let searchIndex = 0;
  while (searchIndex < result.length) {
    const match = scanCallArguments(result, params.validationName, searchIndex);
    if (match == null) {
      break;
    }

    if (!params.validationArgsIsMeta && normalizeArguments(match.args) !== expectedArgs) {
      searchIndex = match.startIndex + 1;
      continue;
    }

    const isBaseCall = result.slice(0, match.startIndex).endsWith(params.joiIdentifierName);
    if (isBaseCall && params.zodValidation == null) {
      searchIndex = match.endIndex;
      continue;
    }

    const replacement =
      params.zodValidation == null
        ? ''
        : `.${
            params.validationArgsIsMeta
              ? substituteMetaArguments(params.zodValidation, params.validationArgs, match.args)
              : params.zodValidation
          }`;

    result = result.slice(0, match.startIndex) + replacement + result.slice(match.endIndex);
    searchIndex = match.startIndex + replacement.length;
  }

  if (result === chainText) {
    return chainText;
  }

  return result
    .split('\n')
    .filter(value => value.trim().length > 0)
    .join('\n')
    .trim();
}

function replaceJoiValidationWithZodEdits(
  root: SgNode<TypesMap, Kinds<TypesMap>>,
  params: { primitive: JoiPrimitives; validationTargetKey: string; zodValidation: string | undefined },
): Array<Edit> {
  const joiImportIdentifierName = getJoiIdentifierName(root);
  if (joiImportIdentifierName == null) {
    return [];
  }

  const validationTargetKeyName = extractNameFromCallExpression(params.validationTargetKey);
  if (validationTargetKeyName == null) {
    return [];
  }

  const validationTargetKeyArgs = extractArgsFromCallExpression(params.validationTargetKey);
  if (validationTargetKeyArgs == null) {
    return [];
  }

  const joiProperties = getJoiProperties(root, {
    primitive: params.primitive,
    validationName: params.validationTargetKey,
  });

  return compactMap(joiProperties, callExpression => {
    const callExpressionText = callExpression.text();
    const replacement = rewriteChain(callExpressionText, {
      validationName: validationTargetKeyName,
      validationArgs: validationTargetKeyArgs,
      validationArgsIsMeta: validationTargetKeyArgs.includes('$'),
      zodValidation: params.zodValidation,
      joiIdentifierName: joiImportIdentifierName,
    });
    if (replacement === callExpressionText) {
      return undefined;
    }

    return callExpression.replace(replacement);
  });
}

export default replaceJoiValidationWithZodEdits;
