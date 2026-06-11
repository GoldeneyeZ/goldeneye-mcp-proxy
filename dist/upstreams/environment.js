export function parseEnvironmentVariables(env) {
    if (!env)
        return undefined;
    const parsed = {};
    const processEnv = process.env;
    for (const [key, value] of Object.entries(env)) {
        parsed[key] = value.replace(/\{env:(\w+)\}/g, (_, envVarName) => {
            return processEnv[envVarName] || "";
        });
    }
    return parsed;
}
//# sourceMappingURL=environment.js.map