export function parseEnvironmentVariables(
  env?: Record<string, string>
): Record<string, string> | undefined {
  if (!env) return undefined;

  const parsed: Record<string, string> = {};
  const processEnv = process.env as Record<string, string>;

  for (const [key, value] of Object.entries(env)) {
    parsed[key] = value.replace(/\{env:(\w+)\}/g, (_, envVarName: string) => {
      return processEnv[envVarName] || "";
    });
  }

  return parsed;
}
