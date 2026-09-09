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

export function uniques<T>(array: Array<T>): Array<T> {
  return Array.from(new Set(array));
}
