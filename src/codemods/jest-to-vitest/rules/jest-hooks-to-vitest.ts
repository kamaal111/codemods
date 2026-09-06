import type { Modifications } from '../../../kit/types.ts';
import { invariant } from '../../../utils/asserts.ts';
import { type FindAndReplaceConfig, findAndReplaceConfigModifications } from '../../utils/find-and-replace.ts';

const INNER_MATCH_KEY = 'INNER';

const JEST_TO_VITEST_HOOKS_MAPPING: Array<FindAndReplaceConfig> = [
  'beforeEach',
  'afterEach',
  'beforeAll',
  'afterAll',
].map(name => ({
  rule: {
    all: [{ pattern: `${name}(() => $${INNER_MATCH_KEY})` }, { not: { pattern: `${name}(() => { $$$ })` } }],
  },
  transformer: node => {
    const innerMatch = node.getMatch(INNER_MATCH_KEY)?.text();
    invariant(innerMatch != null, 'There should be a inner match');

    return `${name}(() => { ${innerMatch} })`;
  },
}));

async function jestHooksToVitest(modifications: Modifications): Promise<Modifications> {
  return findAndReplaceConfigModifications(modifications, JEST_TO_VITEST_HOOKS_MAPPING);
}

export default jestHooksToVitest;
