type ValidationResult = { valid: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validate(schema: unknown, data: unknown): ValidationResult {
  if (!isRecord(schema)) throw new Error('Unknown schema type');

  if (typeof schema.safeParse === 'function') {
    const result: unknown = schema.safeParse(data);
    const succeeded = isRecord(result) && result.success === true;

    return { valid: succeeded };
  }

  if (typeof schema.validate === 'function') {
    const result: unknown = schema.validate(data);
    const hasError = isRecord(result) && result.error != null;

    return { valid: !hasError };
  }

  throw new Error('Unknown schema type');
}
