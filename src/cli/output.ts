import { CliError } from "./types.js";

export type WriteText = (value: string) => unknown;

export function writeSuccess(value: unknown, write: WriteText): void {
  write(`${JSON.stringify(value) ?? "null"}\n`);
}

export function writeFailure(error: unknown, write: WriteText): CliError {
  const cliError = toCliError(error);
  write(`${JSON.stringify({ error: { code: cliError.code, message: cliError.message } })}\n`);
  return cliError;
}

export function toCliError(error: unknown): CliError {
  if (error instanceof CliError) return error;
  return new CliError("INTERNAL_ERROR", "Unexpected CLI error", 5);
}
