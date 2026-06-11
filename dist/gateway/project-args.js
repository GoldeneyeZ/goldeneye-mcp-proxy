export function injectProjectPath(serverKey, args, projectRegistry) {
    if (serverKey !== "codegraph")
        return args;
    if ("projectPath" in args)
        return args;
    const resolved = projectRegistry?.resolveProjectPath();
    return resolved ? { ...args, projectPath: resolved } : args;
}
//# sourceMappingURL=project-args.js.map