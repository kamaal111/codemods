import type { Modifications } from '../../../kit/types.ts';
import { type FindAndReplaceConfig, findAndReplaceConfigModifications } from '../../utils/find-and-replace.ts';
import traverseUp from '../../utils/traverse-up.ts';

const REQUIRE_TO_IMPORT: Array<FindAndReplaceConfig> = [
  {
    rule: { pattern: 'require($PATH)' },
    transformer: node => {
      const pathMatch = node.getMatch('PATH');
      if (pathMatch == null) {
        return undefined;
      }
      const pathText = pathMatch.text().trim();
      const isStringLiteral = pathText.startsWith("'") || pathText.startsWith('"');
      if (!isStringLiteral) {
        return undefined;
      }

      const containingFn = traverseUp(node, n => {
        const kind = n.kind();
        return kind === 'arrow_function' || kind === 'function_declaration' || kind === 'function_expression';
      });

      if (containingFn != null) {
        const fnText = containingFn.text();
        const requireText = node.text();
        const newFnText = fnText.replace(requireText, `(await import(${pathText}))`);
        const asyncFnText = newFnText.startsWith('async ') ? newFnText : `async ${newFnText}`;
        return containingFn.replace(asyncFnText);
      }

      return `(await import(${pathText}))`;
    },
  },
];

export async function requireToDynamicImport(modifications: Modifications): Promise<Modifications> {
  return findAndReplaceConfigModifications(modifications, REQUIRE_TO_IMPORT);
}
