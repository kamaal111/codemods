type Entry<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T];

export function toEntries<Target extends object>(object: Target): Array<Entry<Target>> {
  return Object.entries(object) as Array<Entry<Target>>;
}
