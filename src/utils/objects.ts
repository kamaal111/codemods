type Entry<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T];

export function toEntries<Target extends object>(object: Target): Array<Entry<Target>> {
  return Object.entries(object) as Array<Entry<Target>>;
}

export function omitBy<Value>(
  object: Record<string, Value>,
  predicate: (value: Value, key: string) => boolean,
): Record<string, Value> {
  return Object.fromEntries(Object.entries(object).filter(([key, value]) => !predicate(value, key)));
}
