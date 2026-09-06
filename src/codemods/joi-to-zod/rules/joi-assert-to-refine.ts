import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import { innermostBy } from '../../utils/innermost-nodes.ts';
import { findIdentifierCallChains } from '../../utils/parse-call-chain.ts';
import splitArguments from '../../utils/split-arguments.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';
import { buildValueAccessor, parseJoiReferencePath, referenceToAccessor } from '../utils/object-path-accessor.ts';

function buildAssertReplacement(args: string, joiIdentifierName: string): string | undefined {
  const parsedArgs = splitArguments(args).map(argument => argument.trim());
  const [subject, schema, message] = parsedArgs;
  if (subject == null || schema == null) return undefined;

  const subjectSegments = parseJoiReferencePath(subject);
  if (subjectSegments == null) return undefined;

  const subjectAccessor = buildValueAccessor(subjectSegments);
  const referenceAccessor = referenceToAccessor(schema);
  const predicate =
    referenceAccessor != null
      ? `${subjectAccessor} === ${referenceAccessor}`
      : `${schema}.safeParse(${subjectAccessor}).success`;
  if (referenceAccessor == null && !schema.startsWith(joiIdentifierName)) return undefined;

  const path = subjectSegments.map(segment => `'${segment}'`).join(', ');
  const options = message == null ? `{ path: [${path}] }` : `{ message: ${message}, path: [${path}] }`;

  return `refine(value => ${predicate}, ${options})`;
}

function rewriteAsserts(chainText: string, joiIdentifierName: string): string {
  for (const { segments } of findIdentifierCallChains(chainText, joiIdentifierName)) {
    const baseSegment = segments[0];
    if (baseSegment == null || baseSegment.name !== 'object') continue;

    const assertSegments = segments
      .slice(1)
      .filter(segment => segment.name === 'assert')
      .reverse();
    if (assertSegments.length === 0) continue;

    return assertSegments.reduce((accumulator, segment) => {
      const replacement = buildAssertReplacement(segment.args, joiIdentifierName);
      if (replacement == null) return accumulator;

      return accumulator.slice(0, segment.startIndex) + `.${replacement}` + accumulator.slice(segment.endIndex);
    }, chainText);
  }

  return chainText;
}

async function joiAssertToRefine(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const properties = getJoiProperties(root, { primitive: 'object' });
    const rewrites = compactMap(properties, property => {
      const propertyText = property.text();
      const replacement = rewriteAsserts(propertyText, joiIdentifierName);
      if (replacement === propertyText) return null;

      return { property, replacement };
    });

    return innermostBy(rewrites, rewrite => rewrite.property).map(rewrite => {
      return rewrite.property.replace(rewrite.replacement);
    });
  });
}

export default joiAssertToRefine;
