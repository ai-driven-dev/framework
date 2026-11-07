import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backdateConsent } from "../../e2e/helpers.js";
import { writeUsageTranscripts } from "../../helpers/claude-usage-transcripts.js";
import { git } from "../../helpers/git-sandbox.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import { createTelemetrySandbox, type TelemetrySandbox } from "../../helpers/telemetry-sandbox.js";

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

describe("ingesting the transcripts of an opted-in clone", () => {
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
});
