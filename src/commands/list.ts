import { CODEMOD_REGISTRY, codemodNames } from '../codemods/registry.ts';

export function listCommand(): void {
  const names = codemodNames();
  const longestName = Math.max(...names.map(name => name.length));
  console.log('CODEMODS');
  for (const name of names) {
    console.log(`  ${name.padEnd(longestName)}  ${CODEMOD_REGISTRY[name].summary}`);
  }
}
