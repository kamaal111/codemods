export function findRecordValue<Value>(record: Record<string, Value>, key: string): Value | undefined {
  for (const [recordKey, value] of Object.entries(record)) {
    if (recordKey === key) {
      return value;
    }
  }
}

export function objectKeys<ObjectType extends object>(object: ObjectType): Array<Extract<keyof ObjectType, string>> {
  return Object.keys(object).filter((key): key is Extract<keyof ObjectType, string> => Object.hasOwn(object, key));
}

export function omitBy<Value>(
  object: Record<string, Value>,
  predicate: (value: Value, key: string) => boolean,
): Record<string, Value> {
  return Object.fromEntries(Object.entries(object).filter(([key, value]) => !predicate(value, key)));
}
