import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
// @ts-expect-error Native Node TypeScript execution requires the source extension.
import { createJsonServer } from "./helpers/cli-http-server.ts";

const execFile = promisify(execFileCallback);
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceFiles = [
  "package.json",
  "tsconfig.json",
  "src",
  "README.md",
  "SETUP_PROMPT.md",
  "AGENT-CONTEXT.md",
  "skills",
  "config.example.json",
  "LICENSE",
];
const cliModules = readdirSync(join(repositoryRoot, "src", "cli"))
  .filter(path => path.endsWith(".ts"))
  .map(path => path.replace(/\.ts$/, ".js"));

interface PackReport {
  filename: string;
  files: Array<{ path: string }>;
}

function createCleanPackageFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), "goldeneye-clean-pack-"));
  for (const path of sourceFiles) {
    cpSync(join(repositoryRoot, path), join(fixture, path), { recursive: true });
  }
  symlinkSync(join(repositoryRoot, "node_modules"), join(fixture, "node_modules"), "dir");
  return fixture;
}

async function npmPack(fixture: string, dryRun: boolean): Promise<PackReport> {
  const args = ["pack", "--json"];
  if (dryRun) args.push("--dry-run");
  const { stdout } = await execFile("npm", args, { cwd: fixture });
  return (JSON.parse(stdout) as PackReport[])[0];
}

function assertRequiredFiles(report: PackReport): void {
  const files = report.files.map(file => file.path);
  assert.ok(files.includes("dist/index.js"));
  for (const module of cliModules) {
    assert.ok(files.includes(`dist/cli/${module}`), `missing dist/cli/${module}`);
  }
  assert.ok(files.includes("skills/using-goldeneye-cli/SKILL.md"));
  assert.ok(files.includes("skills/using-goldeneye-cli/agents/openai.yaml"));
}

test("agent-facing docs identify truncation references as top-level fields", () => {
  const paths = ["AGENT-CONTEXT.md", "README.md", "skills/using-goldeneye-cli/SKILL.md"];
  const docs = paths.map(path => [path, readFileSync(join(repositoryRoot, path), "utf8")] as const);
  const metadataRefClaims = [
    /metadata\._?ref/i,
    /metadata\[['"`]_?ref['"`]\]/i,
    /`metadata` will include:\s*(?:\r?\n)?\s*-\s*`_?ref`/i,
    /\bmetadata\s+(?:includes?|contains?)\s+(?:an?\s+)?(?:truncation\s+)?(?:reference|`?_?ref`?)/i,
  ];

  for (const [path, content] of docs) {
    assert.match(content, /_ref/, `${path} omits the truncation reference field`);
    for (const claim of metadataRefClaims) {
      assert.doesNotMatch(content, claim, `${path} claims ref lives in metadata`);
    }
  }

  const agentContext = docs[0][1];
  assert.match(agentContext, /top-level `_ref`, `_truncated`, and `_note`/);
});

test("clean npm package builds and includes the CLI and agent skill", async () => {
  const fixture = createCleanPackageFixture();
  try {
    assertRequiredFiles(await npmPack(fixture, true));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("packed executable provides help and dispatches search", async () => {
  const fixture = createCleanPackageFixture();
  const extracted = join(fixture, "extracted");
  const server = await createJsonServer(body => {
    assert.deepEqual(body, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "gateway.search",
        arguments: { query: "database", limit: 2 },
      },
    });
    return {
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: '{"found":1,"results":[]}' }] },
    };
  });

  try {
    const report = await npmPack(fixture, false);
    assertRequiredFiles(report);
    mkdirSync(extracted);
    await execFile("tar", ["-xzf", join(fixture, basename(report.filename)), "-C", extracted, "--strip-components=1"]);
    symlinkSync(join(repositoryRoot, "node_modules"), join(extracted, "node_modules"), "dir");

    const executable = join(extracted, "dist", "index.js");
    const { stdout: help, stderr: helpError } = await execFile(process.execPath, [executable, "--help"]);
    assert.equal(helpError, "");
    for (const command of ["search", "describe", "invoke", "invoke-async", "invoke-status", "get-result"]) {
      assert.match(help, new RegExp(`goldeneye-mcp-proxy ${command}(?: |\\n)`));
    }

    const { stdout, stderr } = await execFile(process.execPath, [
      executable, "search", "database", "--limit", "2", "--url", server.url,
    ]);
    assert.equal(stderr, "");
    assert.equal(stdout, '{"found":1,"results":[]}\n');
  } finally {
    await server.close();
    rmSync(fixture, { recursive: true, force: true });
  }
});
