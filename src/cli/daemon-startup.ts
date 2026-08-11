import { execFile, spawn } from "node:child_process";

const POLL_INTERVAL_MS = 100;
const DEFAULT_TIMEOUT_MS = 5000;
const SYSTEMD_SERVICE = "goldeneye-mcp-proxy.service";

export interface DaemonStartupDeps {
  health: (url: string) => Promise<boolean>;
  startSystemd: () => Promise<boolean>;
  startDetached: () => void;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => number;
}

export function deriveHealthUrl(mcpUrl: string): string {
  const url = new URL(mcpUrl);
  url.pathname = url.pathname.endsWith("/mcp")
    ? `${url.pathname.slice(0, -4)}/health`
    : "/health";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export async function ensureDaemon(
  mcpUrl: string,
  deps: DaemonStartupDeps = createDefaultDaemonStartupDeps(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  const healthUrl = deriveHealthUrl(mcpUrl);
  const deadline = deps.now() + timeoutMs;

  if (await isHealthy(deps, healthUrl)) return true;

  const systemdStarted = await trySystemd(deps);
  if (systemdStarted) {
    if (await isHealthy(deps, healthUrl)) return true;
    if (await sleepWithinDeadline(deps, deadline) && await isHealthy(deps, healthUrl)) return true;
  }

  try {
    deps.startDetached();
  } catch {
    // Poll through the same bounded window: another process may still be starting.
  }

  while (deps.now() < deadline) {
    if (await isHealthy(deps, healthUrl)) return true;
    if (!await sleepWithinDeadline(deps, deadline)) break;
  }
  return false;
}

export function createDefaultDaemonStartupDeps(): DaemonStartupDeps {
  return {
    health: async (url) => {
      try {
        const response = await fetch(url);
        return response.ok;
      } catch {
        return false;
      }
    },
    startSystemd: () => new Promise<boolean>((resolve) => {
      execFile("systemctl", ["--user", "start", SYSTEMD_SERVICE], error => resolve(!error));
    }),
    startDetached: () => {
      const entrypoint = process.argv[1];
      if (!entrypoint) throw new Error("Cannot determine current Node entrypoint");
      const child = spawn(process.execPath, [entrypoint, "--daemon"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    },
    sleep: (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds)),
    now: () => Date.now(),
  };
}

async function isHealthy(deps: DaemonStartupDeps, url: string): Promise<boolean> {
  try {
    return await deps.health(url);
  } catch {
    return false;
  }
}

async function trySystemd(deps: DaemonStartupDeps): Promise<boolean> {
  try {
    return await deps.startSystemd();
  } catch {
    return false;
  }
}

async function sleepWithinDeadline(deps: DaemonStartupDeps, deadline: number): Promise<boolean> {
  const remaining = deadline - deps.now();
  if (remaining <= 0) return false;
  await deps.sleep(Math.min(POLL_INTERVAL_MS, remaining));
  return true;
}
