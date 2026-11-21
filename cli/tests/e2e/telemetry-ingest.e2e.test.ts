import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeUsageTranscripts } from "../contexts/telemetry/testing/claude-usage-transcripts.builder.js";
import { backdateConsent, createTestEnv, runCli } from "../shared/testing/cli-sandbox.builder.js";
import { initRepository, sandboxGitEnv } from "../shared/testing/git-sandbox.builder.js";

let env: Awaited<ReturnType<typeof createTestEnv>>;
let repoA: string;
let repoB: string;
let claude: string;
let telemetry: string;
let gitEnv: NodeJS.ProcessEnv;

beforeEach(async () => {
  env = await createTestEnv("telemetry-ingest");
  gitEnv = sandboxGitEnv(env.fakeHome);
  repoA = join(env.tempDir, "repo-a");
  repoB = join(env.tempDir, "repo-b");
  claude = join(env.tempDir, "claude-config");
  telemetry = join(env.tempDir, "telemetry-dir");
  initRepository(repoA, gitEnv, { remote: "git@github.com:acme/widgets.git" });
  initRepository(repoB, gitEnv, { remote: "git@github.com:acme/other.git" });
  await mkdir(join(repoA, "src"));
  // Opting in is `on`: a key set by hand opens no consent interval, and nothing is stored.
  const on = await runCli(["telemetry", "on", "--yes", "--anonymous"], repoA, env.fakeHome, {
    env: { AIDD_TELEMETRY_DIR: telemetry, CLAUDE_CONFIG_DIR: claude, AIDD_TELEMETRY: "" },
  });
  expect(on.exitCode, on.stderr + on.stdout).toBe(0);
  await backdateConsent(telemetry);
});

afterEach(async () => {
  await env.cleanup();
});

async function writeTranscripts(only?: readonly string[]): Promise<void> {
  await writeUsageTranscripts(claude, { a: repoA, b: repoB }, only);
}

function ingest(...args: string[]) {
  return runCli(["telemetry", "ingest", ...args], repoA, env.fakeHome, {
    env: { AIDD_TELEMETRY_DIR: telemetry, CLAUDE_CONFIG_DIR: claude, AIDD_TELEMETRY: "" },
  });
}

async function ledgerLines(): Promise<string[]> {
  const text = await readFile(join(telemetry, "ledger", "2026-10-07.jsonl"), "utf8");
  return text.split("\n").filter((line) => line !== "");
}

describe("aidd telemetry ingest", () => {
  it("leaves each key once and no torn line when several ingests start together", async () => {
    await writeTranscripts();
    const runs = await Promise.all([ingest("--quiet"), ingest("--quiet"), ingest("--quiet")]);
    expect(runs.map((run) => run.exitCode)).toEqual([0, 0, 0]);
    const lines = await ledgerLines();
    const keys = lines.map((line) => JSON.parse(line).key);
    expect(keys.sort()).toEqual([
      "msg_A:req_A",
      "msg_B:req_B",
      "msg_B:req_B#advisor0",
      "msg_C:req_C",
    ]);
    expect((await readdir(join(telemetry, "ledger"))).sort()).toEqual([
      "2026-10-07.jsonl",
      "consents.jsonl",
      "offsets.json",
      "roots.json",
    ]);
  });

  it("clears a lock left by a process that is gone and completes", async () => {
    await writeTranscripts();
    await mkdir(join(telemetry, "ledger"), { recursive: true });
    const dead = spawnSync(process.execPath, ["-e", ""]).pid;
    await writeFile(
      join(telemetry, "ledger", ".lock"),
      JSON.stringify({ pid: dead, created_at: new Date().toISOString() })
    );
    const run = await ingest("--quiet");
    expect(run.exitCode).toBe(0);
    expect(await ledgerLines()).toHaveLength(4);
    expect(await readdir(join(telemetry, "ledger"))).not.toContain(".lock");
  });
});
