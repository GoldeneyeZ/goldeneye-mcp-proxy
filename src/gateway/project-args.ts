import type { ProjectRegistry } from "../projects/ProjectRegistry.js";

export function injectProjectPath(
  serverKey: string,
  args: Record<string, unknown>,
  projectRegistry?: ProjectRegistry,
): Record<string, unknown> {
  if (serverKey !== "codegraph") return args;
  if ("projectPath" in args) return args;
  const resolved = projectRegistry?.resolveProjectPath();
  return resolved ? { ...args, projectPath: resolved } : args;
}
