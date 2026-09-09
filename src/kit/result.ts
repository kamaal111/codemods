import { err, ok, ResultAsync, type Result } from 'neverthrow';

export function tryCatch<T>(callback: () => T): Result<T, unknown> {
  try {
    return ok(callback());
  } catch (error) {
    return err(error);
  }
}

export function tryCatchAsync<T>(callback: () => Promise<T>): ResultAsync<T, unknown> {
  return ResultAsync.fromPromise(callback(), error => error);
}

export function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }

  return new Error(String(value));
}
