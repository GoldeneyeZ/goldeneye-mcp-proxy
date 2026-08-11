import { CliError, type CliCommand } from "./types.js";

const GATEWAY_CLI_COMMANDS = new Set([
  "search",
  "describe",
  "invoke",
  "invoke-async",
  "invoke-status",
  "get-result",
]);

type ParsedOptions = Record<string, string>;

export function isGatewayCliCommand(value: unknown): value is CliCommand["kind"] {
  return typeof value === "string" && GATEWAY_CLI_COMMANDS.has(value);
}

export function parseCli(argv: string[]): CliCommand {
  const [kind, positional] = argv;
  if (!isGatewayCliCommand(kind)) {
    invalid("Expected a gateway CLI command");
  }
  if (!positional || positional.startsWith("--")) {
    invalid(`Missing positional argument for ${kind}`);
  }

  switch (kind) {
    case "search": {
      const options = parseOptions(argv, ["--server", "--limit", "--url"]);
      return {
        kind,
        query: positional,
        ...optionalString(options, "--server", "server"),
        ...optionalPositiveInteger(options, "--limit", "limit"),
        ...optionalString(options, "--url", "url"),
      };
    }
    case "describe": {
      const options = parseOptions(argv, ["--url"]);
      return { kind, id: positional, ...optionalString(options, "--url", "url") };
    }
    case "invoke": {
      const options = parseOptions(argv, ["--args", "--timeout", "--url"]);
      return {
        kind,
        id: positional,
        argsSource: requiredOption(options, "--args"),
        ...optionalPositiveInteger(options, "--timeout", "timeoutMs"),
        ...optionalString(options, "--url", "url"),
      };
    }
    case "invoke-async": {
      const options = parseOptions(argv, ["--args", "--url"]);
      return {
        kind,
        id: positional,
        argsSource: requiredOption(options, "--args"),
        ...optionalString(options, "--url", "url"),
      };
    }
    case "invoke-status": {
      const options = parseOptions(argv, ["--url"]);
      return { kind, jobId: positional, ...optionalString(options, "--url", "url") };
    }
    case "get-result": {
      const options = parseOptions(argv, ["--offset", "--limit", "--fields", "--search", "--url"]);
      return {
        kind,
        ref: positional,
        ...optionalNonNegativeInteger(options, "--offset", "offset"),
        ...optionalPositiveInteger(options, "--limit", "limit"),
        ...optionalFields(options),
        ...optionalString(options, "--search", "search"),
        ...optionalString(options, "--url", "url"),
      };
    }
  }
}

function parseOptions(argv: string[], allowed: readonly string[]): ParsedOptions {
  const options: ParsedOptions = {};

  for (let index = 2; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag.startsWith("--")) {
      invalid("Unexpected positional argument");
    }
    if (!allowed.includes(flag)) {
      invalid("Unknown option");
    }
    if (Object.hasOwn(options, flag)) {
      invalid(`Duplicate option: ${flag}`);
    }
    if (value === undefined || value.length === 0 || value.startsWith("--")) {
      invalid(`Missing value for ${flag}`);
    }
    options[flag] = value;
  }

  return options;
}

function requiredOption(options: ParsedOptions, flag: string): string {
  const value = options[flag];
  if (value === undefined) {
    invalid(`Missing required option: ${flag}`);
  }
  return value;
}

function optionalString<Key extends string>(
  options: ParsedOptions,
  flag: string,
  key: Key,
): { [Property in Key]?: string } {
  const value = options[flag];
  return value === undefined ? {} : { [key]: value } as { [Property in Key]?: string };
}

function optionalPositiveInteger<Key extends string>(
  options: ParsedOptions,
  flag: string,
  key: Key,
): { [Property in Key]?: number } {
  return optionalInteger(options, flag, key, 1);
}

function optionalNonNegativeInteger<Key extends string>(
  options: ParsedOptions,
  flag: string,
  key: Key,
): { [Property in Key]?: number } {
  return optionalInteger(options, flag, key, 0);
}

function optionalInteger<Key extends string>(
  options: ParsedOptions,
  flag: string,
  key: Key,
  minimum: number,
): { [Property in Key]?: number } {
  const raw = options[flag];
  if (raw === undefined) return {};
  if (!/^\d+$/.test(raw)) {
    invalid(`${flag} must be an integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    invalid(`${flag} must be ${minimum === 0 ? "non-negative" : "positive"}`);
  }
  return { [key]: value } as { [Property in Key]?: number };
}

function optionalFields(options: ParsedOptions): { fields?: string[] } {
  const raw = options["--fields"];
  if (raw === undefined) return {};
  const fields = raw.split(",").map(field => field.trim());
  if (fields.some(field => field.length === 0)) {
    invalid("--fields must be a comma-separated list of field names");
  }
  return { fields };
}

function invalid(message: string): never {
  throw new CliError("INVALID_ARGS", message, 2);
}
