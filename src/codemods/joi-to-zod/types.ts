const JOI_PRIMITIVE_MAP = {
  STRING: 'string',
  ANY: '*',
  NUMBER: 'number',
  ARRAY: 'array',
  DATE: 'date',
  OBJECT: 'object',
  BOOLEAN: 'boolean',
} as const;

export type JoiPrimitives = (typeof JOI_PRIMITIVE_MAP)[keyof typeof JOI_PRIMITIVE_MAP];
export const JOI_PRIMITIVES = Object.values(JOI_PRIMITIVE_MAP);
