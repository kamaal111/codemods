import type { Codemod } from '../kit/types.ts';
import { JOI_TO_ZOD_CODEMOD } from './joi-to-zod/index.ts';

type CodemodEntry = { codemod: Codemod; summary: string };

/** Every codemod the CLI can run. Adding a codemod means adding an entry here. */
export const CODEMOD_REGISTRY = {
  'joi-to-zod': {
    codemod: JOI_TO_ZOD_CODEMOD,
    summary: 'Rewrite supported Joi schema patterns into Zod equivalents',
  },
} as const satisfies Record<string, CodemodEntry>;

export type CodemodName = keyof typeof CODEMOD_REGISTRY;

export function isCodemodName(value: string): value is CodemodName {
  return Object.hasOwn(CODEMOD_REGISTRY, value);
}

export function codemodNames(): Array<CodemodName> {
  return Object.keys(CODEMOD_REGISTRY) as Array<CodemodName>;
}
