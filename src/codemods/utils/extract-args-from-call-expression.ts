function extractArgsFromCallExpression(callExpression: string | undefined): string | undefined {
  if (callExpression == null) {
    return undefined;
  }

  const trimmed = callExpression.trim();
  const isCallExpression = trimmed.includes('(');
  if (!isCallExpression) {
    return undefined;
  }
  if (trimmed.length === 2) {
    return undefined;
  }

  return trimmed.split('(').slice(1).join('(').slice(undefined, -1);
}

export default extractArgsFromCallExpression;
