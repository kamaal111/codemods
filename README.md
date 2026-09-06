# Codemods

A collection of codemods, runnable as a single CLI.

- [Codemods](#codemods)
  - [Available codemods](#available-codemods)
  - [Usage](#usage)
    - [Flags](#flags)
    - [Examples](#examples)
    - [Config](#config)
  - [Library usage](#library-usage)
  - [Development](#development)
  - [Contributing](#contributing)
  - [License](#license)

## Available codemods

| Codemod          | What it does                                                  | Reference                                          |
| ---------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| `jest-to-vitest` | Rewrite Jest tests and project config into Vitest equivalents | [docs/jest-to-vitest.md](./docs/jest-to-vitest.md) |
| `joi-to-zod`     | Rewrite supported Joi schema patterns into Zod equivalents    | [docs/joi-to-zod.md](./docs/joi-to-zod.md)         |

Each codemod's reference documents what it transforms, its constraints, and its programmatic API.

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

# Run a different codemod
codemods jest-to-vitest src

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

## Library usage

Every codemod is exported for embedding in your own tooling. The transformer functions operate on
source strings and never write files; only the CLI entry point touches disk.

```ts
import { run } from '@kamaalio/codemods';

await run(['joi-to-zod', 'src', '--dry']);
```

`run` accepts the same arguments as the `codemods` executable. It logs to the console and reports
command failures through `process.exitCode`.

For a codemod's own exports — its string transformer, its `Modifications` transformer, and its
codemod definition — see its reference: [jest-to-vitest](./docs/jest-to-vitest.md#library-usage),
[joi-to-zod](./docs/joi-to-zod.md#library-usage).

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
