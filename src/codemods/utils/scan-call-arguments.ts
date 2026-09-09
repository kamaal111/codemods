type CallArgumentsMatch = {
  startIndex: number;
  endIndex: number;
  args: string;
};

const IDENTIFIER_PATTERN = /[$\w]/;
const REGEX_ALLOWED_PRECEDING_PATTERN = /[(,=:[!&|?{};+\-*/%<>~^]/;

function isIdentifierCharacter(character: string | undefined): boolean {
  return character != null && IDENTIFIER_PATTERN.test(character);
}

function startsRegexLiteral(text: string, index: number): boolean {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const character = text[cursor];
    if (character == null || /\s/.test(character)) {
      continue;
    }

    return REGEX_ALLOWED_PRECEDING_PATTERN.test(character);
  }

  return true;
}

export function skipLiteralAt(text: string, index: number): number {
  const character = text[index];
  if (character == null) {
    return index;
  }

  if (character === '/' && text[index + 1] === '/') {
    const lineEnd = text.indexOf('\n', index + 2);

    return lineEnd === -1 ? text.length : lineEnd;
  }

  if (character === '/' && text[index + 1] === '*') {
    const blockEnd = text.indexOf('*/', index + 2);

    return blockEnd === -1 ? text.length : blockEnd + 2;
  }

  const isQuote = character === "'" || character === '"' || character === '`';
  const isRegex = character === '/' && startsRegexLiteral(text, index);
  if (!isQuote && !isRegex) {
    return index;
  }

  const terminator = isRegex ? '/' : character;
  for (let cursor = index + 1; cursor < text.length; cursor += 1) {
    const current = text[cursor];
    if (current === '\\') {
      cursor += 1;
      continue;
    }
    if (isRegex && current === '[') {
      cursor = skipRegexCharacterClass(text, cursor);
      continue;
    }
    if (current === terminator) {
      return cursor + 1;
    }
  }

  return text.length;
}

function skipRegexCharacterClass(text: string, index: number): number {
  for (let cursor = index + 1; cursor < text.length; cursor += 1) {
    const current = text[cursor];
    if (current === '\\') {
      cursor += 1;
      continue;
    }
    if (current === ']') {
      return cursor;
    }
  }

  return text.length;
}

function skipTrivia(text: string, fromIndex: number): number {
  let cursor = fromIndex;

  while (cursor < text.length) {
    const skipped = skipLiteralAt(text, cursor);
    if (skipped !== cursor) {
      cursor = skipped;
      continue;
    }
    if (!/\s/.test(text[cursor] ?? '')) {
      break;
    }

    cursor += 1;
  }

  return cursor;
}

function scanCallArguments(text: string, name: string, fromIndex = 0): CallArgumentsMatch | undefined {
  for (let index = fromIndex; index < text.length; index += 1) {
    const skipped = skipLiteralAt(text, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }

    if (text[index] !== '.') {
      continue;
    }

    const nameIndex = skipTrivia(text, index + 1);
    if (!text.startsWith(name, nameIndex)) {
      continue;
    }
    if (isIdentifierCharacter(text[nameIndex + name.length])) {
      continue;
    }

    let parenthesisIndex = nameIndex + name.length;
    while (parenthesisIndex < text.length && /\s/.test(text[parenthesisIndex] ?? '')) {
      parenthesisIndex += 1;
    }
    if (text[parenthesisIndex] !== '(') {
      continue;
    }

    const closingIndex = findClosingParenthesis(text, parenthesisIndex);
    if (closingIndex == null) {
      continue;
    }

    return {
      startIndex: index,
      endIndex: closingIndex + 1,
      args: text.slice(parenthesisIndex + 1, closingIndex),
    };
  }

  return undefined;
}

function findClosingParenthesis(text: string, openingIndex: number): number | undefined {
  let depth = 0;

  for (let index = openingIndex; index < text.length; index += 1) {
    const skipped = skipLiteralAt(text, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }

    const character = text[index];
    if (character === '(' || character === '[' || character === '{') {
      depth += 1;
    }
    if (character === ')' || character === ']' || character === '}') {
      depth -= 1;
      if (depth === 0) {
        return character === ')' ? index : undefined;
      }
    }
  }

  return undefined;
}

export default scanCallArguments;
