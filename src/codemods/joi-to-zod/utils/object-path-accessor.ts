const STRING_LITERAL_PATTERN = /^(['"])(.*)\1$/s;
const REF_CALL_PATTERN = /^[$\w]+\.ref\(\s*(['"])(.*?)\1\s*\)$/s;

export function parseJoiReferencePath(argument: string): Array<string> | undefined {
  const trimmed = argument.trim();
  const literal = STRING_LITERAL_PATTERN.exec(trimmed) ?? REF_CALL_PATTERN.exec(trimmed);
  if (literal == null) return undefined;

  const raw = literal[2];
  if (raw == null) return undefined;

  const segments = raw
    .replace(/^\./, '')
    .split('.')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);
  if (segments.length === 0) return undefined;

  return segments;
}

export function buildValueAccessor(segments: Array<string>, valueIdentifier = 'value'): string {
  return segments.reduce((accessor, segment, index) => {
    const key = `['${segment}']`;

    return index === 0 ? `${accessor}${key}` : `${accessor}?.${key}`;
  }, valueIdentifier);
}

export function referenceToAccessor(argument: string, valueIdentifier = 'value'): string | undefined {
  const segments = parseJoiReferencePath(argument);
  if (segments == null) return undefined;

  return buildValueAccessor(segments, valueIdentifier);
}
