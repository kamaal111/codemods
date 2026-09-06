export function compactMap<TargetElement, TransformedElement>(
  array: Array<TargetElement>,
  transformer: (value: TargetElement, index: number) => TransformedElement | null | undefined,
): Array<TransformedElement> {
  const newArray: Array<TransformedElement> = [];
  array.forEach((item, index) => {
    const transformedItem = transformer(item, index);
    if (transformedItem == null) {
      return;
    }

    newArray.push(transformedItem);
  });

  return newArray;
}

export function spliced<T>(array: Array<T>, start: number, deleteCount = 0, ...items: Array<T>): Array<T> {
  const copy = [...array];
  copy.splice(start, deleteCount, ...items);

  return copy;
}

export function groupBy<T, K extends keyof T>(array: Array<T>, key: K): Record<string, Array<T>> {
  return [...array].reduce<Record<string, Array<T>>>((acc, current) => {
    const keyValue = String(current[key]);
    const existing = acc[keyValue];
    if (existing == null) {
      acc[keyValue] = [current];
    } else {
      existing.push(current);
    }

    return acc;
  }, {});
}
