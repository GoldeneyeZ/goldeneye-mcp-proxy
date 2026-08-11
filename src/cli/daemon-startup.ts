import { execFile, spawn } from "node:child_process";

const POLL_INTERVAL_MS = 100;
const DEFAULT_TIMEOUT_MS = 5000;
const SYSTEMD_SERVICE = "goldeneye-mcp-proxy.service";

export interface DaemonStartupDeps {
  health: (url: string, timeoutMs: number, signal: AbortSignal) => Promise<boolean>;
  startSystemd: (timeoutMs: number, signal: AbortSignal) => Promise<boolean>;
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

  const initialHealth = await isHealthy(deps, healthUrl, deadline);
  if (initialHealth.value) return true;
  if (initialHealth.timedOut) return false;

  const systemdStarted = await trySystemd(deps, deadline);
  if (systemdStarted.timedOut) return false;
  if (systemdStarted.value) {
    const systemdHealth = await isHealthy(deps, healthUrl, deadline);
    if (systemdHealth.value) return true;
    if (systemdHealth.timedOut) return false;
    if (await sleepWithinDeadline(deps, deadline)) {
      const healthAfterSleep = await isHealthy(deps, healthUrl, deadline);
      if (healthAfterSleep.value) return true;
      if (healthAfterSleep.timedOut) return false;
    }
  }

  if (deps.now() >= deadline) return false;
  try {
    deps.startDetached();
  } catch {
    // Poll through the same bounded window: another process may still be starting.
  }

  while (deps.now() < deadline) {
    const health = await isHealthy(deps, healthUrl, deadline);
    if (health.value) return true;
    if (health.timedOut) break;
    if (!await sleepWithinDeadline(deps, deadline)) break;
  }
  return false;
}

export function createDefaultDaemonStartupDeps(): DaemonStartupDeps {
  return {
    health: async (url, _timeoutMs, signal) => {
      try {
        const response = await fetch(url, { signal });
        return response.ok;
      } catch {
        return false;
      }
    },
    startSystemd: (_timeoutMs, signal) => new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        resolve(value);
      };
      const child = execFile(
        "systemctl",
        ["--user", "start", SYSTEMD_SERVICE],
        error => finish(!error),
      );
      const abort = () => {
        child.kill("SIGTERM");
        finish(false);
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
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

interface DeadlineResult<T> {
  value: T;
  timedOut: boolean;
}

function isHealthy(
  deps: DaemonStartupDeps,
  url: string,
  deadline: number,
): Promise<DeadlineResult<boolean>> {
  return awaitDeadline(deps, deadline, false, (remaining, signal) =>
    deps.health(url, remaining, signal));
}

function trySystemd(
  deps: DaemonStartupDeps,
  deadline: number,
): Promise<DeadlineResult<boolean>> {
  return awaitDeadline(deps, deadline, false, (remaining, signal) =>
    deps.startSystemd(remaining, signal));
}

async function sleepWithinDeadline(deps: DaemonStartupDeps, deadline: number): Promise<boolean> {
  const remaining = deadline - deps.now();
  if (remaining <= 0) return false;
  const sleep = await awaitDeadline(deps, deadline, undefined, () =>
    deps.sleep(Math.min(POLL_INTERVAL_MS, remaining)));
  return !sleep.timedOut;
}

function awaitDeadline<T>(
  deps: DaemonStartupDeps,
  deadline: number,
  fallback: T,
  operation: (remainingMs: number, signal: AbortSignal) => Promise<T>,
): Promise<DeadlineResult<T>> {
  const remaining = deadline - deps.now();
  if (remaining <= 0) return Promise.resolve({ value: fallback, timedOut: true });

  const controller = new AbortController();
  return new Promise(resolve => {
    let settled = false;
    const finish = (result: DeadlineResult<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      controller.abort();
      finish({ value: fallback, timedOut: true });
    }, remaining);

    Promise.resolve()
      .then(() => operation(remaining, controller.signal))
      .then(
        value => finish({ value, timedOut: false }),
        () => finish({ value: fallback, timedOut: false }),
      );
  });
}
