# Repository Guidelines

## Build, Test, and Development Commands

Use `pnpm` 12.3.4 (installed with pnpm's standalone script) on Node.js 26.

- `pnpm bootstrap`: install dependencies from the lockfile.
- `pnpm build`: compile TypeScript to `dist/`.
- `pnpm test`: run the unit test suite once.
- `pnpm test:watch`: run Vitest in watch mode.
- `pnpm test:cov`: collect coverage for `src/`.
- `pnpm test:u`: update snapshots.
- `pnpm test:example`: run the example app tests.
- `pnpm lint` and `pnpm format:check`: enforce oxlint and oxfmt rules.
- `pnpm type-check`, `pnpm type-check:test`, `pnpm type-check:example`: type-check without emitting.
- `pnpm quality`: the local quality gate (lint, format check, both type checks).
- `pnpm preview`: run the CLI against `test/resources/` in dry-run mode.
- `pnpm new:codemod <name>`: scaffold a new codemod.

## Conventions

- Everything is TypeScript. The only JavaScript is `bin/*.mjs`, which npm needs to be
  directly executable. Scripts under `scripts/` are `.ts` and run through Node's type
  stripping — do not add a `.js` or `.mjs` file to work around it.
- Relative imports carry the `.ts` extension; `tsc` rewrites them to `.js` on emit.
- Absent values are `undefined`, not `null`. Prefer `param?: Value` over
  `param: Value | undefined` for optional parameters. Use `== null` / `!= null` for guards so
  both are covered where an external API still hands back `null`.
- Rules go through `commitEditModifications` so the change count and AST history stay accurate.
- New codemods are registered in `src/codemods/registry.ts`; nothing else needs wiring.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to add a codemod.
