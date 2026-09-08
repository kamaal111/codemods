# joi-to-zod

Rewrites supported Joi schema patterns into Zod equivalents.

```bash
codemods joi-to-zod ./src
```

See the [README](../README.md) for CLI flags, config files, and the rest of the collection.

It only touches files that use a default import from `'joi'` or `'@hapi/joi'`, under any local name:

```ts
import Joi from 'joi';
```

If a file does not match that shape, it is ignored.

## What it transforms

The codemod pipeline currently covers these Joi-to-Zod rewrites:

- Adds `import { z } from "zod"` when needed, and removes the `joi` import once the file no longer references it.

**Structure**

- `Joi.object().keys({...})` -> `z.object({...}).strict()`
- `Joi.object({...})` -> `z.object({...}).strict()`; unconstrained `Joi.object()` -> `z.looseObject({})`
- `Joi.object(...).append({...})` -> `.extend({...})`
- `Joi.array().items(schema)` -> `z.array(schema)`; multiple item schemas become an array of a union
- `Joi.array().ordered(a, b)` -> `z.tuple([a, b])`
- `Joi.alternatives().try(a, b)` -> `z.union([a, b])`
- `Joi.object().pattern(key, value)` -> `z.record(key, value)`
- `Joi.binary()` -> `z.instanceof(Buffer)`
- `schema.concat(other)` -> `z.intersection(schema, other)`
- `Joi.forbidden()` -> `z.never()`
- `schema.append({...})` -> `.extend({...})`
- `.valid(...)` -> `z.enum(...)`, or `z.literal(...)` for a non-string primitive
- `.required()` / its absence -> required and `.optional()` object keys; `.default(...)` keeps a key
  required, since a defaulted key is never missing after parsing

`.keys()`, `.items()` and `.ordered()` are picked up wherever they sit in the chain, so
`Joi.object().unknown(true).keys({...})` unnests just like the usual ordering does. The
`.strict()` is skipped when the chain already says what to do with unknown keys.

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
- `exist` -> `required`, `equal` -> `valid`, `not` -> `invalid`
- `unknown(true)` / `unknown(false)` -> `passthrough()` / `strict()`
- `lowercase` / `uppercase` / `case(...)` -> `toLowerCase()` / `toUpperCase()`
- `pattern(...)` -> `regex(...)`, `failover` -> `catch`, `bool()` -> `boolean()`
- `replace(a, b)` -> `transform(value => value.replace(a, b))`
- Annotation/configuration-only calls (`meta`, `tag`, `note`, `example`, `raw`, `cast`, `prefs`, `options`, `preferences`) are dropped

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

**Types.** Joi's schema interfaces are parameterised by the value they validate, which is what
Zod's `ZodType` carries too, so annotations move across rather than being left pointing at a
package the file no longer imports:

- `Joi.Schema`, `Joi.ObjectSchema`, `Joi.StringSchema` and the rest -> `z.ZodType`
- `Joi.ObjectSchema<User>` -> `z.ZodType<User>`
- `Joi.SchemaMap` / `Joi.PartialSchemaMap` -> `z.ZodRawShape`

**Flagged for manual migration.** What is left has no mechanical equivalent, so the codemod
leaves a `TODO(joi-to-zod)` comment naming the Zod construct to reach for:

- `.when(...)` using `switch`, `not`, or `break`, or applied outside an object property
- `.custom(...)` whose callback needs helpers beyond `error` and `message`, or which is
  followed by calls that a transform would remove (`z.string().transform(f).min` does not exist)
- `.assert(...)` whose subject is not a plain reference
- `.insensitive()`, `.creditCard()`, `.truthy(...)`, `.falsy(...)`, `.empty(...)`, `.strip()`,
  `.messages(...)`, `Joi.link(...)`, `Joi.array().single()`, and
  `Joi.alternatives().conditional(...)`
- `.ordered(...)` combined with `.min()` / `.max()` / `.length()`, since a Zod tuple has a fixed
  length and cannot carry those alongside it

## Example

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

## Current constraints

- The codemod only targets files with a default import from `'joi'` or `'@hapi/joi'`, e.g. `import Joi from 'joi'` — the local binding name can be anything. Named imports (`import { object } from 'joi'`) and `require('joi')` are left alone.
- Schemas built through an explicit type argument, `Joi.object<User>({...})`, are left alone: Zod's `z.object` takes an unrelated type argument, so there is no mechanical rewrite.
- `.error(...)` is not flagged, because `helpers.error(...)` inside a `.custom()` callback is indistinguishable from it by name alone.
- The AST language is configured as TypeScript, so this project is best suited to TypeScript-style source files.
- Coverage is driven by the rules and tests in [`src/codemods/joi-to-zod`](../src/codemods/joi-to-zod) and [`test/codemods/joi-to-zod`](../test/codemods/joi-to-zod). Patterns outside those rules may remain unchanged.
- `precision(n)` reproduces Joi's default rounding behaviour. A source schema validated with `convert: false` rejects imprecise input instead of rounding it, and the generated Zod will not match that.
- [`example/joi-to-zod/`](../example/joi-to-zod) is a live before/after fixture: CI type-checks, lints, and runs its behavioural tests against the Joi source, transforms it in place, then runs all three again against the generated Zod.
- The codemod migrates schema declarations. Consumers of Joi's `schema.validate()` result shape and framework-specific schema contracts, such as Hapi route validation, require a manual migration to Zod's parsing APIs.
- The tool is a codemod, not a semantic migration assistant. Review the output before committing.

## Library usage

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

Files without a default import from `'joi'` are returned unchanged.

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
