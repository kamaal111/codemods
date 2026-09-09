import { parseAsync } from '@ast-grep/napi';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../src/codemods/joi-to-zod';
import commitEditModificationsUntilStable from '../../../src/codemods/utils/commit-edit-modifications-until-stable';
import type { Modifications } from '../../../src/kit/types';

const replacements = { '1': '2', '2': '3' } satisfies Record<string, string>;

function incrementNumberUntilThree(modifications: Modifications) {
  const numberNode = modifications.ast.root().findAll({ rule: { kind: 'number' } })[0];
  if (numberNode == null) {
    return [];
  }

  const replacement = Object.entries(replacements).find(([current]) => current === numberNode.text())?.[1];
  if (replacement == null) {
    return [];
  }

  return [numberNode.replace(replacement)];
}

test('commits generated edits until the source no longer changes', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, 'const value = 1;');
  const modifications = makeJoiToZodInitialModification(ast);

  const committed = await commitEditModificationsUntilStable(modifications, incrementNumberUntilThree);

  expect(committed.ast.root().text()).toContain('const value = 3;');
  expect(committed.report.changesApplied).toBe(2);
  expect(committed.history).toHaveLength(3);
});

test('returns the original modifications when the edit builder produces no edits', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, 'const value = 3;');
  const modifications = makeJoiToZodInitialModification(ast);

  const committed = await commitEditModificationsUntilStable(modifications, incrementNumberUntilThree);

  expect(committed).toBe(modifications);
});
