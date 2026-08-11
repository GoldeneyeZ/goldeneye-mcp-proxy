import { CliError } from "./types.js";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: unknown;
}

export class GatewayClient {
  private nextId = 1;

  constructor(private readonly url: string) {}

  async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    let response: Response;
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name, arguments: args },
        }),
      });
    } catch {
      throw new CliError("DAEMON_UNAVAILABLE", "Gateway daemon is unavailable", 3);
    }

    if (!response.ok) throw invalidResponse();

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw invalidResponse();
    }

    if (!isJsonRpcResponse(payload) || payload.id !== id) throw invalidResponse();
    const hasError = Object.prototype.hasOwnProperty.call(payload, "error");
    const hasResult = Object.prototype.hasOwnProperty.call(payload, "result");
    if (hasError === hasResult) throw invalidResponse();
    if (hasError) {
      if (!isJsonRpcError(payload.error)) throw invalidResponse();
      throw new CliError("GATEWAY_ERROR", "Gateway request failed", 4);
    }

    return unwrapContent(payload.result);
  }
}

function unwrapContent(result: unknown): unknown {
  if (!isRecord(result) || !Array.isArray(result.content) || result.content.length !== 1) {
    throw invalidResponse();
  }
  const item = result.content[0];
  if (!isRecord(item) || item.type !== "text" || typeof item.text !== "string") {
    throw invalidResponse();
  }
  try {
    return JSON.parse(item.text);
  } catch {
    throw invalidResponse();
  }
}

function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  return isRecord(value) && value.jsonrpc === "2.0" && typeof value.id === "number";
}

function isJsonRpcError(value: unknown): boolean {
  return isRecord(value) && typeof value.code === "number" && typeof value.message === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalidResponse(): CliError {
  return new CliError("INTERNAL_ERROR", "Invalid response from gateway daemon", 5);
}
