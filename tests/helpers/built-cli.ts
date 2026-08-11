import { execFile } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface BuiltCli {
  buildRoot: string;
  entrypoint: string;
  dispose(): Promise<void>;
}

function runCompiler(executable: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { cwd, encoding: "utf8" }, (error, stdout, stderr) => {
      if (!error) {
        resolve();
        return;
      }
      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      reject(new Error(`Fresh CLI test build failed${output ? `:\n${output}` : ""}`, { cause: error }));
    });
  });
}

export async function createBuiltCli(): Promise<BuiltCli> {
  const repository = fileURLToPath(new URL("../../", import.meta.url));
  const fixture = await mkdtemp(join(tmpdir(), "goldeneye-built-cli-"));
  const output = join(fixture, "dist");

  try {
    await writeFile(join(fixture, "package.json"), '{"type":"module"}\n', "utf8");
    await symlink(join(repository, "node_modules"), join(fixture, "node_modules"), "dir");
    await runCompiler(process.execPath, [
      join(repository, "node_modules", "typescript", "bin", "tsc"),
      "--project", join(repository, "tsconfig.json"),
      "--outDir", output,
      "--declaration", "false",
      "--sourceMap", "false",
    ], repository);
  } catch (error) {
    await rm(fixture, { recursive: true, force: true });
    throw error;
  }

  return {
    buildRoot: fixture,
    entrypoint: join(output, "index.js"),
    dispose: () => rm(fixture, { recursive: true, force: true }),
  };
}
