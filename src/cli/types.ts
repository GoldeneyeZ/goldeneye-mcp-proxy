export class CliError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly exitCode: number,
  ) {
    super(message);
    this.name = "CliError";
  }
}

export type CliCommand =
  | { kind: "search"; query: string; server?: string; limit?: number; url?: string }
  | { kind: "describe"; id: string; url?: string }
  | { kind: "invoke"; id: string; argsSource: string; timeoutMs?: number; url?: string }
  | { kind: "invoke-async"; id: string; argsSource: string; url?: string }
  | { kind: "invoke-status"; jobId: string; url?: string }
  | {
      kind: "get-result";
      ref: string;
      offset?: number;
      limit?: number;
      fields?: string[];
      search?: string;
      url?: string;
    };
