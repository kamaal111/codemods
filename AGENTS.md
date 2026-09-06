# Repository Guidelines

## Build, Test, and Development Commands

Use `yarn` (v4, via Corepack) on Node.js 22.

- `yarn bootstrap`: install dependencies from the lockfile.
- `yarn build`: compile TypeScript to `dist/`.
- `yarn test`: run the unit test suite once.
- `yarn test:watch`: run rstest in watch mode.
- `yarn test:cov`: collect coverage for `src/`.
- `yarn test:u`: update snapshots.
- `yarn test:example`: run the example app tests.
- `yarn lint` and `yarn format:check`: enforce rslint and prettier rules.
- `yarn type-check`, `yarn type-check:test`, `yarn type-check:example`: type-check without emitting.
- `yarn quality`: the local quality gate (lint, format check, both type checks).
- `yarn preview`: run the CLI against `test/resources/` in dry-run mode.
- `yarn new:codemod <name>`: scaffold a new codemod.

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
