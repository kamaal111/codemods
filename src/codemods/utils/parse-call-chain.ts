import { skipLiteralAt } from './scan-call-arguments.ts';

export type ChainSegment = {
  name: string;
  args: string;
  startIndex: number;
  endIndex: number;
};

type IdentifierCallChain = {
  rootStartIndex: number;
  segments: Array<ChainSegment>;
};

const IDENTIFIER_PATTERN = /[$\w]/;

function findClosingParenthesis(text: string, openingIndex: number): number | undefined {
  let depth = 0;

  for (let index = openingIndex; index < text.length; index += 1) {
    const skipped = skipLiteralAt(text, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }

    const character = text[index];
    if (character === '(' || character === '[' || character === '{') depth += 1;
    if (character === ')' || character === ']' || character === '}') {
      depth -= 1;
      if (depth === 0) return character === ')' ? index : undefined;
    }
  }

  return undefined;
}

function parseCallChain(text: string, rootEndIndex: number): Array<ChainSegment> {
  const segments: Array<ChainSegment> = [];
  let cursor = rootEndIndex;

  while (cursor < text.length) {
    let dotIndex = cursor;
    while (dotIndex < text.length && /\s/.test(text[dotIndex] ?? '')) dotIndex += 1;
    if (text[dotIndex] !== '.') break;

    let nameEnd = dotIndex + 1;
    while (nameEnd < text.length && IDENTIFIER_PATTERN.test(text[nameEnd] ?? '')) nameEnd += 1;
    if (nameEnd === dotIndex + 1) break;

    let parenthesisIndex = nameEnd;
    while (parenthesisIndex < text.length && /\s/.test(text[parenthesisIndex] ?? '')) parenthesisIndex += 1;
    if (text[parenthesisIndex] !== '(') break;

    const closingIndex = findClosingParenthesis(text, parenthesisIndex);
    if (closingIndex == null) break;

    segments.push({
      name: text.slice(dotIndex + 1, nameEnd),
      args: text.slice(parenthesisIndex + 1, closingIndex),
      startIndex: dotIndex,
      endIndex: closingIndex + 1,
    });
    cursor = closingIndex + 1;
  }

  return segments;
}

export function* findIdentifierCallChains(text: string, identifierName: string): Iterable<IdentifierCallChain> {
  for (let rootStartIndex = 0; rootStartIndex < text.length; rootStartIndex += 1) {
    if (!text.startsWith(identifierName, rootStartIndex)) continue;
    if (rootStartIndex > 0 && /[$\w.]/.test(text[rootStartIndex - 1] ?? '')) continue;

    yield {
      rootStartIndex,
      segments: parseCallChain(text, rootStartIndex + identifierName.length),
    };
  }
}

export default parseCallChain;
