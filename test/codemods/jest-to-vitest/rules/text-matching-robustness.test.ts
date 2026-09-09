import jestToVitest from '../../../../src/codemods/jest-to-vitest';

async function transform(body: string): Promise<string> {
  return jestToVitest(body, 'sample.test.ts');
}

describe('vi.mock factory normalisation is not confused by string contents', () => {
  it('normalises a factory whose body holds the word return inside a string', async () => {
    const output = await transform(
      `jest.mock('./m', () => {\n  const label = 'return early';\n  return { a: 1 };\n});\ntest('a', () => { expect(1).toBe(1); });`,
    );

    expect(output).toContain('const mockedModule = { a: 1 }');
    expect(output).toContain('default: mockedModule');
  });

  it('normalises a factory whose body holds a brace inside a string', async () => {
    const output = await transform(
      `jest.mock('./m', () => {\n  const open = '{';\n  return { a: 1 };\n});\ntest('a', () => { expect(1).toBe(1); });`,
    );

    expect(output).toContain('const mockedModule = { a: 1 }');
    expect(output).toContain('default: mockedModule');
  });

  it('still skips a factory whose real return is not an object', async () => {
    const output = await transform(
      `jest.mock('./m', () => {\n  return someValue;\n});\ntest('a', () => { expect(1).toBe(1); });`,
    );

    expect(output).not.toContain('mockedModule');
  });
});

describe('restoreAllMocks compatibility is not confused by mentions', () => {
  it('still adds clearAllMocks when a comment merely mentions it', async () => {
    const output = await transform(
      `afterEach(() => {\n  // superseded by vi.clearAllMocks() in setup\n  jest.restoreAllMocks();\n});\ntest('a', () => { expect(1).toBe(1); });`,
    );

    expect(output).toContain('vi.restoreAllMocks(); vi.clearAllMocks()');
  });

  it('still adds clearAllMocks when a string merely mentions it', async () => {
    const output = await transform(
      `afterEach(() => {\n  console.log('vi.clearAllMocks()');\n  jest.restoreAllMocks();\n});\ntest('a', () => { expect(1).toBe(1); });`,
    );

    expect(output).toContain('vi.restoreAllMocks(); vi.clearAllMocks()');
  });

  it('does not add a second clearAllMocks when the block already calls it', async () => {
    const output = await transform(
      `afterEach(() => {\n  jest.restoreAllMocks();\n  jest.clearAllMocks();\n});\ntest('a', () => { expect(1).toBe(1); });`,
    );

    expect(output.match(/clearAllMocks/g)).toHaveLength(1);
  });
});

describe('done callback conversion is not confused by comments', () => {
  it('converts a done callback whose body follows a comment', async () => {
    const output = await transform(`test('a', (done) => /* setup */ {\n  done();\n});`);

    expect(output).toContain('new Promise<void>');
    expect(output).not.toContain('(done) =>');
  });
});

describe('default-key detection reads the object, not its text', () => {
  it('adds the shim when default appears only on a nested object', async () => {
    const output = await transform(
      `jest.mock('./m', () => ({ a: { default: 1 } }));\ntest('a', () => { expect(1).toBe(1); });`,
    );

    expect(output).toContain('const mockedModule = { a: { default: 1 } }');
    expect(output).toContain('default: mockedModule');
  });

  it('adds the shim when default appears only inside a string', async () => {
    const output = await transform(
      `jest.mock('./m', () => ({ a: 'x, default: y' }));\ntest('a', () => { expect(1).toBe(1); });`,
    );

    expect(output).toContain('default: mockedModule');
  });

  it('still leaves an object that really declares default alone', async () => {
    const output = await transform(
      `jest.mock('./m', () => ({ default: 1 }));\ntest('a', () => { expect(1).toBe(1); });`,
    );

    expect(output).not.toContain('mockedModule');
  });
});
