import fs from 'node:fs/promises';

import z, { prettifyError } from 'zod';

import { tryCatch, tryCatchAsync } from './result.ts';

const CodemodConfigSchema = z.object({
  paths: z.array(z.string().nonempty()).nonempty(),
  dry_run: z.boolean().optional(),
  log: z.boolean().optional(),
});

export type CodemodConfig = z.infer<typeof CodemodConfigSchema>;

class ConfigError extends Error {
  readonly cause: unknown;

  constructor(message: string, options?: { cause: unknown }) {
    super(message);

    this.cause = options?.cause;
  }
}

export class ConfigNotFoundError extends ConfigError {
  constructor(configPath: string, options?: { cause: unknown }) {
    super(`No config file found at '${configPath}'. Check that the path is correct.`, options);
  }
}

export class ConfigParseError extends ConfigError {
  constructor(configPath: string, options?: { cause: unknown }) {
    const reason = options?.cause instanceof Error ? options.cause.message : String(options?.cause);
    super(`Config file at '${configPath}' is not valid JSON: ${reason}`, options);
  }
}

export class ConfigValidationError extends ConfigError {
  constructor(configPath: string, zodError: z.ZodError, options?: { cause: unknown }) {
    super(`Config file at '${configPath}' failed schema validation:\n${prettifyError(zodError)}`, options);
  }
}

export async function loadCodemodConfig(configPath: string): Promise<CodemodConfig>;
export async function loadCodemodConfig<Schema extends z.ZodType<CodemodConfig>>(
  configPath: string,
  schema: Schema,
): Promise<z.infer<Schema>>;
export async function loadCodemodConfig(
  configPath: string,
  schema: z.ZodType<CodemodConfig> = CodemodConfigSchema,
): Promise<CodemodConfig> {
  const readResult = await tryCatchAsync(() => fs.readFile(configPath, { encoding: 'utf-8' }));
  if (readResult.isErr()) {
    throw new ConfigNotFoundError(configPath, { cause: readResult.error });
  }

  const parsedResult = tryCatch(() => JSON.parse(readResult.value));
  if (parsedResult.isErr()) {
    throw new ConfigParseError(configPath, { cause: parsedResult.error });
  }

  const validated = await schema.safeParseAsync(parsedResult.value);
  if (!validated.success) {
    throw new ConfigValidationError(configPath, validated.error);
  }

  return validated.data;
}
