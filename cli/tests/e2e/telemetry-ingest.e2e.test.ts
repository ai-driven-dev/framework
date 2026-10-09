import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git, initRepository, sandboxGitEnv } from "../helpers/git-sandbox.js";
import { createTestEnv, runCli } from "./helpers.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures/claude-usage/projects");
const GRANTED = JSON.stringify({ telemetry: { enabled: true, version: 2 } });

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
  await mkdir(join(repoA, ".aidd"));
  await writeFile(join(repoA, ".aidd", "config.json"), GRANTED);
});

afterEach(async () => {
  await env.cleanup();
});

/** The fixture transcripts, with their machine paths pointed at the temp repositories. */
async function writeTranscripts(only?: readonly string[]): Promise<void> {
  const target = join(claude, "projects");
  await cp(FIXTURES, target, { recursive: true });
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (only !== undefined && !only.some((name) => path.endsWith(name))) await rm(path);
      else {
        const text = await readFile(path, "utf8");
        const jsonText = (p: string): string => JSON.stringify(p).slice(1, -1);
        await writeFile(
          path,
          text
            .replaceAll("/work/repo-wt-a", jsonText(repoA))
            .replaceAll("/work/repo-wt-b", jsonText(repoB))
        );
      }
    }
  };
  await walk(target);
}

function ingest(...args: string[]) {
  return runCli(["telemetry", "ingest", ...args], repoA, env.fakeHome, {
    env: { AIDD_TELEMETRY_DIR: telemetry, CLAUDE_CONFIG_DIR: claude, AIDD_TELEMETRY: "" },
  });
}

async function ledgerLines(): Promise<string[]> {
  const text = await readFile(join(telemetry, "ledger", "2026-10.jsonl"), "utf8");
  return text.split("\n").filter((line) => line !== "");
}

describe("aidd telemetry ingest", () => {
  it("stores each billed call once, and a second ingest adds nothing", async () => {
    await writeTranscripts();
    const first = await ingest();
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toContain("4 calls added");
    expect(first.stdout).toContain("1 call from a project that has not opted in");
    const before = await readFile(join(telemetry, "ledger", "2026-10.jsonl"), "utf8");
    const keys = (await ledgerLines()).map((line) => JSON.parse(line).key).sort();
    expect(keys).toEqual(["msg_A:req_A", "msg_B:req_B", "msg_B:req_B#advisor0", "msg_C:req_C"]);

    const second = await ingest();
    expect(second.stdout).toContain("Read 0 transcripts: 0 calls added, 0 updated");
    expect(await readFile(join(telemetry, "ledger", "2026-10.jsonl"), "utf8")).toBe(before);
  });

  it("ties each call to the repository id, never to its url or path", async () => {
    await writeTranscripts();
    await ingest();
    const lines = await ledgerLines();
    const ids = new Set(lines.map((line) => JSON.parse(line).repository_id));
    expect(ids.size).toBe(1);
    const text = lines.join("\n");
    expect(text).not.toContain("github.com");
    expect(text).not.toContain("widgets");
  });

  it("prints nothing with --quiet and still stores", async () => {
    await writeTranscripts();
    const run = await ingest("--quiet");
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe("");
    expect(run.stderr).toBe("");
    expect(await ledgerLines()).toHaveLength(4);
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
      "2026-10.jsonl",
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

  it("stores calls from a directory deleted after it was seen alive, and counts one never seen", async () => {
    await writeTranscripts(["s-1.jsonl"]);
    expect((await ingest("--quiet")).exitCode).toBe(0);
    expect(await ledgerLines()).toHaveLength(3);

    await rm(repoA, { recursive: true, force: true });
    await cp(
      join(FIXTURES, "proj-a", "s-1", "subagents"),
      join(claude, "projects", "proj-a", "s-1", "subagents"),
      {
        recursive: true,
      }
    );
    const agent = join(claude, "projects", "proj-a", "s-1", "subagents", "agent-x.jsonl");
    const ghost = join(env.tempDir, "never-existed");
    await writeFile(
      agent,
      `${(await readFile(agent, "utf8")).replaceAll("/work/repo-wt-a", JSON.stringify(repoA).slice(1, -1)).trimEnd()}\n${(
        await readFile(agent, "utf8")
      )
        .replaceAll("/work/repo-wt-a", JSON.stringify(ghost).slice(1, -1))
        .replaceAll("msg_C", "msg_G")
        .replaceAll("req_C", "req_G")
        .trimEnd()}\n`
    );
    const run = await runCli(["telemetry", "ingest"], env.tempDir, env.fakeHome, {
      env: { AIDD_TELEMETRY_DIR: telemetry, CLAUDE_CONFIG_DIR: claude, AIDD_TELEMETRY: "" },
    });
    expect(run.stdout).toContain("1 call added");
    expect(run.stdout).toContain("1 call from a directory never seen while it existed");
    expect((await ledgerLines()).map((line) => JSON.parse(line).key)).toContain("msg_C:req_C");
  });

  it("stores nothing and creates nothing under AIDD_TELEMETRY=0", async () => {
    await writeTranscripts();
    const run = await runCli(["telemetry", "ingest"], repoA, env.fakeHome, {
      env: { AIDD_TELEMETRY_DIR: telemetry, CLAUDE_CONFIG_DIR: claude, AIDD_TELEMETRY: "0" },
    });
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("AIDD_TELEMETRY=0");
    await expect(stat(telemetry)).rejects.toThrow();
  });

  it("stores nothing for a project that never opted in", async () => {
    await writeTranscripts();
    await rm(join(repoA, ".aidd"), { recursive: true });
    const run = await ingest();
    expect(run.stdout).toContain("0 calls added");
    expect(run.stdout).toContain("5 calls from a project that has not opted in");
    expect(await readdir(join(telemetry, "ledger"))).not.toContain("2026-10.jsonl");
  });

  it("snapshots the branch declarations of a project that opted in", async () => {
    await writeTranscripts();
    git(repoA, gitEnv, "config", "branch.feat/a.aiddTask", "checkout-fix");
    git(repoA, gitEnv, "config", "branch.feat/a.aiddDeclaredAt", "2026-10-07T09:00:00.000Z");
    const run = await ingest();
    expect(run.stdout).toContain("1 branch declaration snapshotted");
    const text = await readFile(join(telemetry, "bindings", "branches.jsonl"), "utf8");
    expect(JSON.parse(text.trim())).toMatchObject({ branch: "feat/a", task: "checkout-fix" });
  });
});
