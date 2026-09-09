function extractNameFromCallExpression(callExpression: string | undefined): string | undefined {
  if (callExpression == null) {
    return undefined;
  }

  const isCallExpression = callExpression.includes('(');
  if (!isCallExpression) {
    return callExpression;
  }

  return callExpression.split('(')[0];
}

export default extractNameFromCallExpression;
