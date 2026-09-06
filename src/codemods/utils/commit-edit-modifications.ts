import { type Edit, parseAsync } from '@ast-grep/napi';

import type { Modifications } from '../../kit/types.ts';

async function commitEditModifications(edits: Array<Edit>, modifications: Modifications): Promise<Modifications> {
  if (edits.length === 0) return modifications;

  const root = modifications.ast.root();
  const committed = root.commitEdits(edits);
  const modifiedAST = await parseAsync(modifications.lang, committed);

  return {
    ...modifications,
    ast: modifiedAST,
    report: { changesApplied: modifications.report.changesApplied + edits.length },
    history: modifications.history.concat([modifiedAST]),
  };
}

export default commitEditModifications;
