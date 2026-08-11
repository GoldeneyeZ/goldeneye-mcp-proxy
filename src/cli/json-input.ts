import { CliError } from "./types.js";

export type ReadStdin = () => Promise<string>;

export async function readArgs(source: string, readStdin: ReadStdin): Promise<Record<string, unknown>> {
  const input = source === "-" ? await readStdin() : source;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new CliError("INVALID_ARGS", "--args must contain valid JSON", 2);
  }

  if (!isPlainObject(parsed)) {
    throw new CliError("INVALID_ARGS", "--args must contain a JSON object", 2);
  }
  return parsed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
