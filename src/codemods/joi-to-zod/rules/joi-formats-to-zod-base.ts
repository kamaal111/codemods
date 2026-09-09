import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import type { JoiPrimitives } from '../types.ts';
import type { JoiNode } from '../utils/get-joi-call-chain.ts';
import { getJoiCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

const FORMAT_BASE_TRANSFORMATIONS: Array<{ primitive: JoiPrimitives; joi: string; zod: string }> = [
  { primitive: 'string', joi: 'guid', zod: 'uuid()' },
  { primitive: 'string', joi: 'uuid', zod: 'uuid()' },
  { primitive: 'string', joi: 'uri', zod: 'url()' },
  { primitive: 'string', joi: 'url', zod: 'url()' },
  { primitive: 'string', joi: 'email', zod: 'email()' },
  { primitive: 'string', joi: 'domain', zod: 'hostname()' },
  { primitive: 'string', joi: 'hostname', zod: 'hostname()' },
  { primitive: 'string', joi: 'hex', zod: 'hex()' },
  { primitive: 'string', joi: 'base64', zod: 'base64()' },
  { primitive: 'string', joi: 'isoDate', zod: 'iso.datetime()' },
  { primitive: 'string', joi: 'datetime', zod: 'iso.datetime()' },
  { primitive: 'string', joi: 'isoDuration', zod: 'iso.duration()' },
];

function hoistFormatToBase(
  node: JoiNode,
  joiIdentifierName: string,
  params: { primitive: JoiPrimitives; joi: string; zod: string },
): string | undefined {
  const chain = getJoiCallChain(node, joiIdentifierName);
  const baseSegment = chain?.segments[0];
  if (chain == null || baseSegment?.name !== params.primitive) return undefined;

  const formatSegment = chain.segments.find(
    segment => segment.name === params.joi && segment.arguments.length === 0 && segment !== baseSegment,
  );
  if (formatSegment == null) return undefined;

  const offset = node.range().start.index;
  const withoutFormat =
    node.text().slice(0, formatSegment.receiver.range().end.index - offset) +
    node.text().slice(formatSegment.call.range().end.index - offset);

  return (
    withoutFormat.slice(0, baseSegment.call.range().start.index - offset) +
    `${joiIdentifierName}.${params.zod}` +
    withoutFormat.slice(baseSegment.call.range().end.index - offset)
  );
}

async function joiFormatsToZodBase(modifications: Modifications): Promise<Modifications> {
  return transformFormats(modifications, 0);
}

async function transformFormats(modifications: Modifications, transformationIndex: number): Promise<Modifications> {
  const transformation = FORMAT_BASE_TRANSFORMATIONS[transformationIndex];
  if (transformation == null) return modifications;

  const applied = await applyFormatTransformation(modifications, transformation);

  return transformFormats(applied, transformationIndex + 1);
}

async function applyFormatTransformation(
  modifications: Modifications,
  transformation: { primitive: JoiPrimitives; joi: string; zod: string },
): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const properties = getJoiProperties(root, {
      primitive: transformation.primitive,
      validationName: `${transformation.joi}()`,
    });
    return compactMap(properties, property => {
      const replacement = hoistFormatToBase(property, joiIdentifierName, transformation);
      if (replacement == null || replacement === property.text()) return undefined;

      return property.replace(replacement);
    });
  });
}

export default joiFormatsToZodBase;
