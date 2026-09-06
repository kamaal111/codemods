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

| Path                  | What lives there                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/kit/`            | The generic codemod engine: target resolution, the runner, config loading                                                                                                                           |
| `src/codemods/`       | One folder per codemod, plus `registry.ts`                                                                                                                                                          |
| `src/codemods/utils/` | AST helpers shared across codemods                                                                                                                                                                  |
| `src/commands/`       | The CLI commands                                                                                                                                                                                    |
| `test/`               | Mirrors `src/`                                                                                                                                                                                      |
| `example/`            | A live before/after fixture that CI transforms and re-tests. `schemas.zod.ts` is a generated, git-committed snapshot of the codemod's current output, kept in sync by `yarn check:example-snapshot` |

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
stale.

## Auditing what a codemod actually produces

`example/schemas.ts` is a Joi fixture demonstrating each rule; `example/schemas.zod.ts` is a
generated, git-committed snapshot of what the joi-to-zod codemod currently turns it into, so the
output is readable in source without having to run the transform yourself. Regenerate it with:

```bash
yarn generate:example-snapshot
```

`yarn check:example-snapshot` (run as part of `yarn quality`) regenerates the snapshot into a
scratch copy and fails if it doesn't match the committed file — so whenever you change
`example/schemas.ts`, run `yarn generate:example-snapshot` and commit the updated
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
