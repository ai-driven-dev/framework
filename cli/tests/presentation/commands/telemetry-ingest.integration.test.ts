import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeUsageTranscripts } from "../../contexts/telemetry/testing/claude-usage-transcripts.builder.js";
import {
  createTelemetrySandbox,
  type TelemetrySandbox,
} from "../../contexts/telemetry/testing/telemetry-sandbox.builder.js";
import { backdateConsent } from "../../shared/testing/cli-sandbox.builder.js";
import { git } from "../../shared/testing/git-sandbox.builder.js";
import { runInProcess } from "../../shared/testing/in-process-cli.builder.js";

const FIXTURES = join(import.meta.dirname, "..", "..", "fixtures", "claude-usage", "projects");

let box: TelemetrySandbox;
let repoA: string;
let repoB: string;

beforeEach(async () => {
  box = createTelemetrySandbox();
  repoA = box.repository("repo-a");
  repoB = box.repository("repo-b");
  git(repoA, box.gitEnv, "remote", "set-url", "origin", "git@github.com:acme/widgets.git");
  await mkdir(join(repoA, "src"));
  // Opting in is `on`: a key set by hand opens no consent interval, and nothing is stored.
  const on = await cli(["on", "--yes", "--anonymous"]);
  expect(on.exitCode, on.stderr + on.stdout).toBe(0);
  await backdateConsent(box.telemetry);
});

afterEach(async () => {
  await rm(box.root, { recursive: true, force: true });
});

function cli(args: string[], extra: Record<string, string> = {}, cwd = repoA) {
  return runInProcess(["telemetry", ...args], { cwd, home: box.home, env: box.env(extra) });
}

async function writeTranscripts(only?: readonly string[]): Promise<void> {
  await writeUsageTranscripts(box.claude, { a: repoA, b: repoB }, only);
}

async function ledgerLines(): Promise<string[]> {
  const text = await readFile(join(box.telemetry, "ledger", "2026-10-07.jsonl"), "utf8");
  return text.split("\n").filter((line) => line !== "");
}

/** Every file under the telemetry directory with its bytes: what a run changed shows. */
async function held(): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const entry of await readdir(box.telemetry, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    found[relative(box.telemetry, path)] = await readFile(path, "utf8");
  }
  return found;
}

describe("ingesting the transcripts of an opted-in clone", () => {
  it("stores each billed call once, and a second ingest adds nothing", async () => {
    await writeTranscripts();
    const first = await cli(["ingest"]);
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toContain("4 calls added");
    expect(first.stdout).toContain("1 call from a clone with no consent at that time");
    const ledger = join(box.telemetry, "ledger", "2026-10-07.jsonl");
    const before = await readFile(ledger, "utf8");
    const keys = (await ledgerLines()).map((line) => JSON.parse(line).key).sort();
    expect(keys).toEqual(["msg_A:req_A", "msg_B:req_B", "msg_B:req_B#advisor0", "msg_C:req_C"]);

    const second = await cli(["ingest"]);
    expect(second.stdout).toContain("Read 0 transcripts: 0 calls added, 0 updated");
    expect(await readFile(ledger, "utf8")).toBe(before);
  });

  it("stores nothing and changes nothing under AIDD_TELEMETRY=0", async () => {
    await writeTranscripts();
    const before = await held();

    const run = await cli(["ingest"], { AIDD_TELEMETRY: "0" });

    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("AIDD_TELEMETRY=0");
    expect(await held()).toEqual(before);
  });

  it("ties each call to the repository id, never to its url or path", async () => {
    await writeTranscripts();
    await cli(["ingest"]);
    const lines = await ledgerLines();
    const ids = new Set(lines.map((line) => JSON.parse(line).repository_id));
    expect(ids.size).toBe(1);
    const text = lines.join("\n");
    expect(text).not.toContain("github.com");
    expect(text).not.toContain("widgets");
  });

  it("prints nothing with --quiet and still stores", async () => {
    await writeTranscripts();
    const run = await cli(["ingest", "--quiet"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe("");
    expect(run.stderr).toBe("");
    expect(await ledgerLines()).toHaveLength(4);
  });

  it("stores calls from a directory deleted after it was seen alive, and counts one never seen", async () => {
    await writeTranscripts(["s-1.jsonl"]);
    expect((await cli(["ingest", "--quiet"])).exitCode).toBe(0);
    expect(await ledgerLines()).toHaveLength(3);

    await rm(repoA, { recursive: true, force: true });
    await cp(
      join(FIXTURES, "proj-a", "s-1", "subagents"),
      join(box.claude, "projects", "proj-a", "s-1", "subagents"),
      { recursive: true }
    );
    const agent = join(box.claude, "projects", "proj-a", "s-1", "subagents", "agent-x.jsonl");
    const ghost = join(box.root, "never-existed");
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
    const run = await cli(["ingest"], {}, box.root);
    expect(run.stdout).toContain("1 call added");
    expect(run.stdout).toContain("1 call from a directory never seen while it existed");
    expect((await ledgerLines()).map((line) => JSON.parse(line).key)).toContain("msg_C:req_C");
  });

  it("stores nothing for a clone whose key was set by hand, though it says 2", async () => {
    await writeTranscripts();
    await rm(box.telemetry, { recursive: true, force: true });
    git(repoA, box.gitEnv, "config", "--local", "--unset", "aidd.telemetry");
    git(repoA, box.gitEnv, "config", "--local", "aidd.telemetry", "2");
    const run = await cli(["ingest"]);
    expect(run.stdout).toContain("0 calls added");
    // No clone ever opted in: no transcript is read, so no call is even counted.
    expect(run.stdout).toContain("Read 0 transcripts");
  });

  it("snapshots the branch declarations of a project that opted in", async () => {
    await writeTranscripts();
    git(repoA, box.gitEnv, "config", "branch.feat/a.aiddTask", "checkout-fix");
    git(repoA, box.gitEnv, "config", "branch.feat/a.aiddDeclaredAt", "2026-10-07T09:00:00.000Z");
    const run = await cli(["ingest"]);
    expect(run.stdout).toContain("1 branch declaration snapshotted");
    const text = await readFile(join(box.telemetry, "bindings", "branches.jsonl"), "utf8");
    expect(JSON.parse(text.trim())).toMatchObject({ branch: "feat/a", task: "checkout-fix" });
  });

  // Limit: this runs `ingest --quiet` in process, the command the catch-up hook starts, not the
  // hook. The hook alone is proven by scripts/__tests__/aidd-telemetry-hooks.test.js; no test
  // runs the hook against a built binary.
  it("keeps nothing of a clone that never opted in, and reports what it measured and could not store", async () => {
    const elsewhere = box.repository("elsewhere");
    git(elsewhere, box.gitEnv, "remote", "set-url", "origin", "git@github.com:acme/other.git");
    const projects = join(box.claude, "projects", "sandbox");
    await mkdir(projects, { recursive: true });
    const call = (cwd: string, id: string, timestamp: string) =>
      JSON.stringify({
        type: "assistant",
        sessionId: "a1b2c3d4-0000-4000-8000-0000000000a1",
        requestId: `req_${id}`,
        timestamp,
        version: "2.1.0",
        cwd,
        message: {
          id: `msg_${id}`,
          model: "m-big",
          usage: { input_tokens: 1, output_tokens: 10, cache_creation_input_tokens: 0 },
        },
      });
    const junk = (cwd: string) => JSON.stringify({ type: "assistant", cwd, message: { usage: 7 } });
    const at = "2026-10-07T10:00:00.000Z";

    await writeFile(
      join(projects, "d4e5f6a7.jsonl"),
      `${[call(elsewhere, "2", at), junk(elsewhere), call(elsewhere, "3", "not a time"), "{torn"].join("\n")}\n`
    );
    expect((await cli(["ingest", "--quiet"])).exitCode).toBe(0);
    expect(existsSync(join(box.telemetry, "ledger", "left-out.txt"))).toBe(false);

    await writeFile(
      join(projects, "a1b2c3d4.jsonl"),
      `${[call(repoA, "1", at), junk(repoA), call(repoA, "3", "not a time")].join("\n")}\n`
    );
    expect((await cli(["ingest", "--quiet"])).exitCode).toBe(0);
    const report = await cli(["report", "--from", "2026-10-07", "--to", "2026-10-08", "--json"]);
    expect(report.exitCode, report.stderr).toBe(0);
    expect(JSON.parse(report.stdout)).toMatchObject({
      coverage: { records: 1, left_out: { undated: 1, unrecognised: 1 } },
      run: { files_read: 0 },
    });
  });
});
