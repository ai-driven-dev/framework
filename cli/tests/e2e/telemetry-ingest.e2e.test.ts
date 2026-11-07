import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeUsageTranscripts } from "../helpers/claude-usage-transcripts.js";
import { initRepository, sandboxGitEnv } from "../helpers/git-sandbox.js";
import { backdateConsent, createTestEnv, runCli } from "./helpers.js";

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

/** Every file under the telemetry directory with its bytes: what a run changed shows. */
async function held(): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const entry of await readdir(telemetry, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    found[relative(telemetry, path)] = await readFile(path, "utf8");
  }
  return found;
}

async function ledgerLines(): Promise<string[]> {
  const text = await readFile(join(telemetry, "ledger", "2026-10-07.jsonl"), "utf8");
  return text.split("\n").filter((line) => line !== "");
}

describe("aidd telemetry ingest", () => {
  it("stores each billed call once, and a second ingest adds nothing", async () => {
    await writeTranscripts();
    const first = await ingest();
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toContain("4 calls added");
    expect(first.stdout).toContain("1 call from a clone with no consent at that time");
    const before = await readFile(join(telemetry, "ledger", "2026-10-07.jsonl"), "utf8");
    const keys = (await ledgerLines()).map((line) => JSON.parse(line).key).sort();
    expect(keys).toEqual(["msg_A:req_A", "msg_B:req_B", "msg_B:req_B#advisor0", "msg_C:req_C"]);

    const second = await ingest();
    expect(second.stdout).toContain("Read 0 transcripts: 0 calls added, 0 updated");
    expect(await readFile(join(telemetry, "ledger", "2026-10-07.jsonl"), "utf8")).toBe(before);
  });

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
      "repository-ids.json",
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

  it("stores nothing and changes nothing under AIDD_TELEMETRY=0", async () => {
    await writeTranscripts();
    const before = await held();
    const run = await runCli(["telemetry", "ingest"], repoA, env.fakeHome, {
      env: { AIDD_TELEMETRY_DIR: telemetry, CLAUDE_CONFIG_DIR: claude, AIDD_TELEMETRY: "0" },
    });
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("AIDD_TELEMETRY=0");
    expect(await held()).toEqual(before);
  });
});
