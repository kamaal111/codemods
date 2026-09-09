import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import type { Modifications } from '../../../kit/types.ts';
import { type FindAndReplaceConfig, findAndReplaceConfigModifications } from '../../utils/find-and-replace.ts';

type AstNode = SgNode<TypesMap, Kinds<TypesMap>>;

function getDoneParamName(node: AstNode): string | undefined {
  const params = node.children().find(c => c.kind() === 'formal_parameters');
  if (params != null) {
    const paramChildren = params.children().filter(c => c.kind() === 'required_parameter' || c.kind() === 'identifier');
    const [param] = paramChildren;
    if (paramChildren.length !== 1 || param == null) {
      return undefined;
    }
    if (param.kind() === 'identifier') {
      return param.text();
    }
    const ident = param.children().find((c: AstNode) => c.kind() === 'identifier');
    return ident?.text() ?? undefined;
  }

  const firstChild = node.children()[0];
  if (firstChild != null && firstChild.kind() === 'identifier') {
    return firstChild.text();
  }

  return undefined;
}

const DONE_CALLBACK_TO_PROMISE: Array<FindAndReplaceConfig> = [
  {
    rule: {
      any: [
        { pattern: 'test($NAME, $CALLBACK)' },
        { pattern: 'test($NAME, $CALLBACK, $TIMEOUT)' },
        { pattern: 'it($NAME, $CALLBACK)' },
        { pattern: 'it($NAME, $CALLBACK, $TIMEOUT)' },
      ],
    },
    transformer: node => {
      const callback = node.getMatch('CALLBACK');
      if (callback == null) {
        return undefined;
      }

      const kind = callback.kind();
      if (kind !== 'arrow_function') {
        return undefined;
      }

      const paramName = getDoneParamName(callback);
      if (paramName == null || paramName !== 'done') {
        return undefined;
      }

      const body = callback.field('body');
      if (body?.kind() !== 'statement_block') {
        return undefined;
      }

      const bodyContent = body.text().slice(1, -1);
      const newCallback = `() => new Promise<void>((resolve, reject) => { const done = (err?: unknown) => err ? reject(err) : resolve();${bodyContent}})`;

      const nodeOffset = node.range().start.index;
      const nodeText = node.text();

      return (
        nodeText.slice(0, callback.range().start.index - nodeOffset) +
        newCallback +
        nodeText.slice(callback.range().end.index - nodeOffset)
      );
    },
  },
];

export async function doneCallbackToPromise(modifications: Modifications): Promise<Modifications> {
  return findAndReplaceConfigModifications(modifications, DONE_CALLBACK_TO_PROMISE);
}
