# Contributing

This repo exists to make codemods a normal thing to reach for. Adding one should feel routine.

## Getting set up

```bash
corepack enable   # activates the Yarn version pinned in package.json
yarn install
yarn test
```

Node 22 (see [`.nvmrc`](./.nvmrc)) runs TypeScript directly, so there is no build step for
`scripts/` or for the dev CLI entry. A dev container is provided if you would rather not
install anything locally.

## How the repo is laid out

| Path                  | What lives there                                                          |
| --------------------- | ------------------------------------------------------------------------- |
| `src/kit/`            | The generic codemod engine: target resolution, the runner, config loading |
| `src/codemods/`       | One folder per codemod, plus `registry.ts`                                |
| `src/codemods/utils/` | AST helpers shared across codemods                                        |
| `src/commands/`       | The CLI commands                                                          |
| `test/`               | Mirrors `src/`                                                            |
| `docs/`               | One reference per codemod, linked from the README's table                 |
| `example/<codemod>/`  | A live before/after fixture per codemod that CI transforms and re-tests   |

You should rarely need to touch `src/kit/`. Almost all work happens in `src/codemods/`.

## How a codemod works

A codemod is a chain of **rules**. Each rule is a function that takes a `Modifications`
object and returns a new one:

```ts
async function myRule(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const edits = /* find nodes with ast-grep, build edits */;

  return commitEditModifications(edits, modifications);
}
```

`Modifications` carries the parsed AST, a count of applied changes, and the history of every
intermediate AST. `commitEditModifications` applies edits, reparses, and appends to that
history — always go through it rather than mutating the AST yourself, so the change count and
history stay honest.

The codemod's `index.ts` chains the rules in a fixed order:

```ts
return firstRule(modifications).then(secondRule).then(thirdRule);
```

Order matters. Rules that unwrap structure generally run after the rules that rewrite the
things inside it.

## Adding a codemod

1. Scaffold it:

   ```bash
   yarn new:codemod my-codemod
   ```

   This creates `src/codemods/my-codemod/` and `test/codemods/my-codemod/`, and prints the
   registry entry to paste.

2. Register it in `src/codemods/registry.ts`. That is the only wiring step — the CLI, the
   `list` command, and the top-level help all read from the registry.

3. Write rules under `src/codemods/my-codemod/rules/`, one file per transformation, each
   default-exporting a `(modifications) => Promise<Modifications>` function.

4. Chain them in `src/codemods/my-codemod/index.ts`.

5. Test each rule (see below), then run `yarn quality`.

6. Document it in `docs/my-codemod.md` (the scaffolder writes a stub) and add a row to the
   `Available codemods` table in [README.md](./README.md) linking to it. Codemod-specific
   documentation lives in `docs/`, not in the README — the README stays a front door.

## Writing rule tests

Rule tests use the helpers in `test/test-utils/detection-theory.ts`, which assert both
directions of a rule in one call:

- `invalidRuleSignal(source, lang, transform)` — the rule **should** fire: it asserts the
  source changed, the change count went up, the history grew, and snapshots the output.
- `validRuleSignal(source, lang, transform)` — the rule **should not** fire: it asserts
  nothing changed.

Every rule wants at least one of each. A rule with only a positive test will happily rewrite
things it should have left alone.

```ts
import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import myRule from '../../../../src/codemods/my-codemod/rules/my-rule';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';
```

Snapshots are generated on first run; review them before committing, and refresh them
deliberately with `yarn test:u`.

`yarn test:cov` enforces coverage thresholds. If you add a codemod and the numbers move,
adjust the thresholds in `rstest.config.ts` in the same change rather than leaving them
stale. Prefer a per-codemod threshold glob over lowering the collection-wide numbers, so one
codemod's coverage does not quietly relax another's.

## Auditing what a codemod actually produces

Each codemod gets a fixture under `example/<codemod>/` that CI transforms and re-tests, so a
codemod that silently does nothing cannot go green. The two are shaped differently, because the
codemods are:

- `example/joi-to-zod/` is a set of schemas whose behavioural tests pass against Joi and Zod alike.
- `example/jest-to-vitest/` is a whole installable Jest project — its own `package.json` and
  `jest.config.ts`, installed with npm outside the Yarn workspace (the empty `yarn.lock` marks the
  boundary), because the point is that it flips from a real Jest install to a real Vitest one.
  It transforms TypeScript with `@swc/jest` rather than `ts-jest`, which is what lets it run the
  same TypeScript 7 as the rest of the repo: ts-jest needs the JavaScript compiler API that
  TypeScript 7's native compiler no longer exposes. Run the round trip locally with
  `yarn transform:example:jest`; restore it afterwards with `git checkout example/jest-to-vitest`.

Each fixture also has a generated, git-committed snapshot of what the codemod currently turns it
into, so the output is readable in source without having to run the transform yourself:

- `example/joi-to-zod/schemas.zod.ts` for joi-to-zod, a single transformed file.
- `example/jest-to-vitest.snapshot/` for jest-to-vitest, holding every file the codemod changed or
  generated — the rewritten tests, the generated `vitest.config.ts`, and the `package.json` with
  its updated `devDependencies`. Files the codemod leaves alone are not repeated there, since they
  are already readable in the fixture.

Regenerate both with:

```bash
yarn generate:example-snapshot
```

`yarn check:example-snapshot` (run as part of `yarn quality`) regenerates the snapshot into a
scratch copy and fails if it doesn't match the committed file — so whenever you change
`example/joi-to-zod/schemas.ts`, run `yarn generate:example-snapshot` and commit the updated
`schemas.zod.ts` alongside it, or `yarn quality` will fail.

Not every rule branch can be demonstrated this way: a couple of joi-to-zod branches (an
unsupported `when()` option, and an `assert()` whose subject isn't a plain reference) are
"leave it alone and stamp a manual-migration TODO comment" branches by design, so exercising them
in the fixture would leave code that calls Joi-only methods on a Zod schema after transformation,
permanently breaking the fixture's before/after round trip. Those branches are covered instead by
their rule-level unit tests (`test/codemods/joi-to-zod/rules/joi-when-to-refine.test.ts`,
`joi-assert-to-refine.test.ts`, and `joi-add-manual-migration-todo.test.ts`).

## Before you push

```bash
yarn quality   # lint, format check, both type checks, and the example-snapshot sync check
yarn test
```

`yarn preview` runs the CLI against `test/resources` in dry-run mode if you want to eyeball
the output.
