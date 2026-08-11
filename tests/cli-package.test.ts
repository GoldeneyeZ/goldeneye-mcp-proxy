import test from "node:test";
import assert from "node:assert/strict";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

const execFile = promisify(execFileCallback);

async function npmPackFileList(): Promise<string[]> {
  const { stdout } = await execFile("npm", ["pack", "--dry-run", "--json"]);
  const report = JSON.parse(stdout) as Array<{ files: Array<{ path: string }> }>;
  return report[0].files.map(file => file.path);
}

test("npm package includes CLI skill", async () => {
  const files = await npmPackFileList();
  assert.ok(files.includes("skills/using-goldeneye-cli/SKILL.md"));
  assert.ok(files.includes("skills/using-goldeneye-cli/agents/openai.yaml"));
});
