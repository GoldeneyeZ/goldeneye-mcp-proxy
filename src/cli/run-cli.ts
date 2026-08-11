import { ensureDaemon as ensureDaemonDefault } from "./daemon-startup.js";
import { GatewayClient } from "./gateway-client.js";
import { readArgs } from "./json-input.js";
import { writeFailure, writeSuccess, type WriteText } from "./output.js";
import { parseCli } from "./parse-cli.js";
import { CliError, type CliCommand } from "./types.js";

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:8767/mcp";

export interface RunCliDeps {
  call: (name: string, args: Record<string, unknown>, url: string) => Promise<unknown>;
  ensureDaemon: (url: string) => Promise<boolean>;
  readStdin: () => Promise<string>;
  stdout: WriteText;
  stderr: WriteText;
  env: Record<string, string | undefined>;
}

export async function runCli(argv: string[], deps: RunCliDeps = createDefaultRunCliDeps()): Promise<number> {
  try {
    const command = parseCli(argv);
    const url = command.url ?? deps.env.MCP_GATEWAY_URL ?? DEFAULT_GATEWAY_URL;
    const [name, args] = await toGatewayCall(command, deps.readStdin);

    let result: unknown;
    try {
      result = await deps.call(name, args, url);
    } catch (error) {
      if (!isDaemonUnavailable(error)) throw error;
      if (!await deps.ensureDaemon(url)) throw error;
      result = await deps.call(name, args, url);
    }

    writeSuccess(result, deps.stdout);
    return 0;
  } catch (error) {
    return writeFailure(error, deps.stderr).exitCode;
  }
}

export function createDefaultRunCliDeps(): RunCliDeps {
  return {
    call: (name, args, url) => new GatewayClient(url).call(name, args),
    ensureDaemon: (url) => ensureDaemonDefault(url),
    readStdin: readAllStdin,
    stdout: value => process.stdout.write(value),
    stderr: value => process.stderr.write(value),
    env: process.env,
  };
}

async function toGatewayCall(
  command: CliCommand,
  readStdin: () => Promise<string>,
): Promise<[string, Record<string, unknown>]> {
  switch (command.kind) {
    case "search":
      return ["gateway.search", defined({
        query: command.query,
        server: command.server,
        limit: command.limit,
      })];
    case "describe":
      return ["gateway.describe", { id: command.id }];
    case "invoke":
      return ["gateway.invoke", defined({
        id: command.id,
        args: await readArgs(command.argsSource, readStdin),
        timeoutMs: command.timeoutMs,
      })];
    case "invoke-async":
      return ["gateway.invoke_async", {
        id: command.id,
        args: await readArgs(command.argsSource, readStdin),
      }];
    case "invoke-status":
      return ["gateway.invoke_status", { jobId: command.jobId }];
    case "get-result":
      return ["gateway.get_result", defined({
        ref: command.ref,
        offset: command.offset,
        limit: command.limit,
        fields: command.fields,
        search: command.search,
      })];
  }
}

function defined(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

function isDaemonUnavailable(error: unknown): error is CliError {
  return error instanceof CliError && error.code === "DAEMON_UNAVAILABLE";
}

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
