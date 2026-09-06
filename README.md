# Codemods

A collection of codemods, runnable as a single CLI.

- [Codemods](#codemods)
  - [Available codemods](#available-codemods)
  - [Usage](#usage)
    - [Flags](#flags)
    - [Examples](#examples)
    - [Config](#config)
  - [joi-to-zod](#joi-to-zod)
    - [What it transforms](#what-it-transforms)
    - [Example](#example)
    - [Current constraints](#current-constraints)
  - [Library usage](#library-usage)
  - [Development](#development)
  - [Contributing](#contributing)
  - [License](#license)

## Available codemods

| Codemod      | What it does                                               |
| ------------ | ---------------------------------------------------------- |
| `joi-to-zod` | Rewrite supported Joi schema patterns into Zod equivalents |

`codemods list` prints the same table from the registry.

## Usage

Run it without installing anything:

```bash
npx @kamaalio/codemods joi-to-zod ./src
```

Or install it globally:

```bash
npm install -g @kamaalio/codemods
codemods joi-to-zod ./src
```

The CLI takes the codemod name as its command, followed by a path:

```bash
codemods <codemod> [PATH] [FLAGS]
```

`PATH` may be a file or a directory, and defaults to `.`.

### Flags

| Flag       | Default | Description                                                                     |
| ---------- | ------- | ------------------------------------------------------------------------------- |
| `--dry`    | `false` | Print what would change without writing files                                   |
| `--no-log` | `false` | Disable log output                                                              |
| `--config` | —       | Path to a JSON config file listing the paths to migrate (see [Config](#config)) |

`--config` and `PATH` are mutually exclusive: pass one or the other, not both.

Each flag also accepts a short form (`-d`, `-n`, `-c`) and its uppercase alias (`-D`, `-N`, `-C`).

### Examples

```bash
# Transform the current directory
codemods joi-to-zod

# Transform a specific directory
codemods joi-to-zod src

# Transform a single file
codemods joi-to-zod src/schemas.ts

# Preview changes without writing them
codemods joi-to-zod src --dry

# Run quietly
codemods joi-to-zod src --no-log

# Transform the paths listed in a config file
codemods joi-to-zod --config joi-migration-phase1.json

# List the available codemods
codemods list
```

### Config

For larger or staged migrations, pass `--config` with a JSON file listing the paths to transform instead of a single `PATH`:

```json
{
  "paths": ["src/controllers"]
}
```

Each entry in `paths` is transformed the same way a positional `PATH` argument would be. The config file can also set `dry_run` to default that run to dry-run mode, without needing `--dry` on the command line, and `log` to control log output, without needing `--no-log`:

```json
{
  "paths": ["src/controllers"],
  "dry_run": true,
  "log": false
}
```

Passing both `--dry` and a config `dry_run` at the same time is an error — pick one. The same applies to `--no-log` and a config `log` — pick one.

## joi-to-zod

Rewrites supported Joi schema patterns into Zod equivalents. It only touches files that use a default Joi import:

```ts
import Joi from 'joi';
```

If a file does not match that shape, it is ignored.

### What it transforms

The codemod pipeline currently covers these Joi-to-Zod rewrites:

- Adds `import { z } from "zod"` when needed, and removes the `joi` import once the file no longer references it.

**Structure**

- `Joi.object().keys({...})` -> `z.object({...}).strict()`
- `Joi.array().items(schema)` -> `z.array(schema)`
- `Joi.alternatives().try(a, b)` -> `z.union([a, b])`
- `Joi.object().pattern(key, value)` -> `z.record(key, value)`
- `Joi.binary()` -> `z.instanceof(Buffer)`
- `schema.concat(other)` -> `z.intersection(schema, other)`
- `Joi.forbidden()` -> `z.never()`
- `.valid(...)` -> `z.enum(...)`, or `z.literal(...)` for a non-string primitive
- `.required()` / its absence -> required and `.optional()` object keys

**String formats** are emitted as Zod 4 top-level schemas, replacing the primitive rather
than chaining onto it, because `z.string().hex()` and friends do not exist in Zod 4. This
holds wherever the format sits in the chain, so `Joi.string().min(6).hex()` becomes
`z.hex().min(6)`:

- `guid` -> `z.uuid()`, `uri` -> `z.url()`, `email` -> `z.email()`, `domain` -> `z.hostname()`
- `hex` -> `z.hex()`, `base64` -> `z.base64()`
- `isoDate` -> `z.iso.datetime()`, `isoDuration` -> `z.iso.duration()`

**Dates** become coercing schemas, since Joi accepts ISO strings where `z.date()` would not:

- `Joi.date()` -> `z.coerce.date()`; `.iso()` and `.timestamp()` are dropped as redundant
- `.min('2020-01-01')` -> `.min(new Date('2020-01-01'))`, `.max('now')` -> `.max(new Date())`
- `.greater` / `.less` -> `.min` / `.max`

**Validations that need composed Zod.** Where Joi has no single Zod counterpart, the
codemod composes one rather than leaving the call behind:

- `alphanum` -> `regex(/^[a-zA-Z0-9]+$/)` (both cases, matching Joi), `token` -> `regex(/^\w+$/)`
- `precision(n)` -> `transform(value => Number(value.toFixed(n)))`, matching Joi's rounding
- `port()` -> `int().min(0).max(65535)`, `sign('positive')` -> `positive()`
- `Joi.array().unique()` -> `refine(value => new Set(value).size === value.length)`
- `Joi.object()` peer rules `and` / `or` / `xor` / `oxor` / `nand` / `with` / `without` -> `refine(...)`
- `Joi.object().min(n)` / `.max(n)` / `.length(n)` -> `refine` over `Object.keys(value).length`
- `invalid(...)` / `disallow(...)` -> `refine(value => ![...].includes(value))`
- `ip()` -> a refine over `z.ipv4()` and `z.ipv6()`

**Direct mappings**

- `integer` -> `int`, `greater` / `less` -> `gt` / `lt`, `multiple` -> `multipleOf`
- `description` / `label` -> `describe`, `allow(null)` -> `nullable`, `required(false)` -> `optional`
- `unknown(true)` / `unknown(false)` -> `passthrough()` / `strict()`
- `lowercase` / `uppercase` / `case(...)` -> `toLowerCase()` / `toUpperCase()`
- `pattern(...)` -> `regex(...)`, `failover` -> `catch`, `bool()` -> `boolean()`
- Annotation-only calls (`meta`, `tag`, `note`, `example`, `raw`, `cast`, `prefs`) are dropped

**Conditionals and callbacks.** A Joi conditional lives on the property but needs the whole
object to evaluate, so it is lifted to an object-level refinement and the property becomes
optional, with presence enforced by the refinement instead:

```ts
// before
detail: Joi.string().when('type', { is: 'a', then: Joi.required(), otherwise: Joi.forbidden() });

// after
detail: z.string().optional();
// ...on the object:
.refine(value => !(value['type'] === 'a') || value['detail'] !== undefined, { path: ['detail'] })
.refine(value => (value['type'] === 'a') || value['detail'] === undefined, { path: ['detail'] })
```

- `.when()` handles `is` as a literal, a `Joi.ref(...)`, or a schema, and `then` / `otherwise`
  as `required()`, `optional()`, `forbidden()`, or a full schema. A bare schema `is` also
  matches an absent key, because a Joi schema is optional unless it says otherwise.
- `.assert(subject, schema, message?)` -> a refinement comparing against the referenced key,
  or parsing the subject against the schema.
- `.custom(fn)` -> `.transform(fn)`. When the callback uses Joi's `helpers`, it is kept
  verbatim and handed a shim mapping `helpers.error` / `helpers.message` onto Zod's `ctx`.

**Flagged for manual migration.** What is left has no mechanical equivalent, so the codemod
leaves a `TODO(joi-to-zod)` comment naming the Zod construct to reach for:

- `.when(...)` using `switch`, `not`, or `break`, or applied outside an object property
- `.custom(...)` whose callback needs helpers beyond `error` and `message`, or which is
  followed by calls that a transform would remove (`z.string().transform(f).min` does not exist)
- `.assert(...)` whose subject is not a plain reference

### Example

Input:

```ts
import Joi from 'joi';

enum MemberStatus {
  Active = 'active',
  Inactive = 'inactive',
}

export const memberSchema = Joi.object().keys({
  id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  status: Joi.string()
    .valid(...Object.values(MemberStatus))
    .required(),
  website: Joi.string().uri(),
  metadata: Joi.object().pattern(Joi.string(), Joi.number()),
});
```

Output:

```ts
import { z } from 'zod';

enum MemberStatus {
  Active = 'active',
  Inactive = 'inactive',
}

export const memberSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    status: z.enum(MemberStatus),
    website: z.url().optional(),
    metadata: z.record(z.string(), z.number()).optional(),
  })
  .strict();
```

The codemod does not format its output. Run your formatter over the changed files afterwards.

### Current constraints

- The codemod only targets files with a default `import Joi from 'joi'`.
- The AST language is configured as TypeScript, so this project is best suited to TypeScript-style source files.
- Coverage is driven by the rules and tests in [`src/codemods/joi-to-zod`](./src/codemods/joi-to-zod) and [`test/codemods/joi-to-zod`](./test/codemods/joi-to-zod). Patterns outside those rules may remain unchanged.
- `precision(n)` reproduces Joi's default rounding behaviour. A source schema validated with `convert: false` rejects imprecise input instead of rounding it, and the generated Zod will not match that.
- [`example/`](./example) is a live before/after fixture: CI type-checks, lints, and runs its behavioural tests against the Joi source, transforms it in place, then runs all three again against the generated Zod.
- The codemod migrates schema declarations. Consumers of Joi's `schema.validate()` result shape and framework-specific schema contracts, such as Hapi route validation, require a manual migration to Zod's parsing APIs.
- The tool is a codemod, not a semantic migration assistant. Review the output before committing.

## Library usage

The package has a small programmatic API for embedding the Joi-to-Zod migration in your own tooling. It does not write files unless you use the CLI entry point; the transformer functions operate on source strings.

### Transform a source string

Use the default export when you want the transformed source. Pass a filename when available so custom tooling can retain it in transformation metadata.

```ts
import joiToZod from '@kamaalio/codemods';

const source = "import Joi from 'joi';\n\nexport const id = Joi.string().required();\n";
const transformed = await joiToZod(source, 'src/schema.ts');

// import { z } from "zod";
//
// export const id = z.string();
```

Files without a default `Joi` import are returned unchanged.

### Inspect transformation details

Use `joiToZodTransformer` when you need the AST, number of edits, or transformation history in addition to the generated source.

```ts
import { joiToZodTransformer } from '@kamaalio/codemods';

const source = "import Joi from 'joi';\n\nexport const id = Joi.string().required();\n";
const result = await joiToZodTransformer(source, 'src/schema.ts');

console.log(result.report.changesApplied);
const transformed = result.ast.root().text();
```

### Integrate with a codemod runner

`JOI_TO_ZOD_CODEMOD` is the complete codemod definition, including its name, supported language, and string transformer. `JOI_TO_ZOD_LANGUAGE` is the corresponding ast-grep language constant.

```ts
import { JOI_TO_ZOD_CODEMOD, JOI_TO_ZOD_LANGUAGE } from '@kamaalio/codemods';

const source = "import Joi from 'joi';\n\nexport const id = Joi.string().required();\n";
const transformed = await JOI_TO_ZOD_CODEMOD.transformer(source, 'src/schema.ts');
console.log(JOI_TO_ZOD_LANGUAGE, transformed);
```

### Invoke the CLI from JavaScript

`run` accepts the same arguments as the `codemods` executable. It logs to the console and reports command failures through `process.exitCode`.

```ts
import { run } from '@kamaalio/codemods';

await run(['joi-to-zod', 'src', '--dry']);
```

## Development

Use `yarn` on Node.js `22` (see [`.nvmrc`](./.nvmrc)). Yarn 4 is activated through Corepack:

```bash
corepack enable
yarn install
yarn build
yarn test
```

Every task lives in `package.json` — there is no task runner to install:

| Script                    | What it does                                         |
| ------------------------- | ---------------------------------------------------- |
| `yarn bootstrap`          | Install dependencies from the lockfile               |
| `yarn build`              | Compile `src/` to `dist/` with `tsc`                 |
| `yarn clean:build`        | Remove `dist/` and rebuild                           |
| `yarn test`               | Run the test suite once                              |
| `yarn test:watch`         | Run the test suite in watch mode                     |
| `yarn test:cov`           | Run the test suite with coverage                     |
| `yarn test:u`             | Update snapshots                                     |
| `yarn test:example`       | Run the `example/` behavioural tests                 |
| `yarn type-check`         | Type-check `src/`                                    |
| `yarn type-check:test`    | Type-check tests and scripts                         |
| `yarn type-check:example` | Type-check `example/`                                |
| `yarn lint`               | Lint with rslint                                     |
| `yarn format`             | Format with prettier                                 |
| `yarn format:check`       | Check formatting                                     |
| `yarn quality`            | Lint, format check, and both type checks             |
| `yarn preview`            | Run the CLI against `test/resources` in dry-run mode |
| `yarn transform:example`  | Run the CLI against `example/`                       |
| `yarn new:codemod <name>` | Scaffold a new codemod                               |
| `yarn release <version>`  | Publish to npm                                       |

## Contributing

Adding a codemod takes about ten minutes. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT. See [LICENSE](./LICENSE).
