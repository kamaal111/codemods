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

export function uniques<T>(array: Array<T>): Array<T> {
  return Array.from(new Set(array));
}
