import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import { findIdentifierCallChains } from '../../utils/parse-call-chain.ts';
import type { JoiPrimitives } from '../types.ts';
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
  chainText: string,
  joiIdentifierName: string,
  params: { primitive: JoiPrimitives; joi: string; zod: string },
): string {
  const result = chainText;

  for (const { segments } of findIdentifierCallChains(result, joiIdentifierName)) {
    const baseSegment = segments[0];
    if (baseSegment == null || baseSegment.name !== params.primitive) continue;

    const formatSegment = segments.find(segment => segment.name === params.joi && segment.args.trim().length === 0);
    if (formatSegment == null) continue;

    const withoutFormat = result.slice(0, formatSegment.startIndex) + result.slice(formatSegment.endIndex);

    return (
      withoutFormat.slice(0, baseSegment.startIndex) + `.${params.zod}` + withoutFormat.slice(baseSegment.endIndex)
    );
  }

  return result;
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
      const propertyText = property.text();
      const replacement = hoistFormatToBase(propertyText, joiIdentifierName, transformation);
      if (replacement === propertyText) return undefined;

      return property.replace(replacement);
    });
  });
}

export default joiFormatsToZodBase;
