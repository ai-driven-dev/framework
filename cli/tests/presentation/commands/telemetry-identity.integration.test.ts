import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backdateConsent } from "../../e2e/helpers.js";
import { writeUsageTranscripts } from "../../helpers/claude-usage-transcripts.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import { createTelemetrySandbox, type TelemetrySandbox } from "../../helpers/telemetry-sandbox.js";

let box: TelemetrySandbox;
let userConfig: string;

beforeEach(async () => {
  box = createTelemetrySandbox();
  userConfig = join(box.root, "user-config");
  const repo = box.repository("repo-a");
  await writeUsageTranscripts(box.claude, { a: repo, b: box.repository("repo-b") });
  const on = await aidd(["on", "--yes", "--anonymous"], repo);
  expect(on.exitCode, on.stderr + on.stdout).toBe(0);
  await backdateConsent(box.telemetry);
});

afterEach(async () => {
  await rm(box.root, { recursive: true, force: true });
});

function aidd(args: string[], cwd = join(box.root, "repo-a")) {
  return runInProcess(["telemetry", ...args], {
    cwd,
    home: box.home,
    env: box.env({ AIDD_USER_CONFIG_DIR: userConfig }),
  });
}

async function personRows(): Promise<string[]> {
  const run = await aidd([
    "report",
    "--from",
    "2026-10-07",
    "--to",
    "2026-10-08",
    "--axis",
    "person",
    "--json",
  ]);
  expect(run.exitCode, run.stderr).toBe(0);
  const envelope = JSON.parse(run.stdout) as {
    rows: { key: string | null; reason: string | null; kind: string }[];
  };
  return envelope.rows.map((row) => row.key ?? row.reason ?? row.kind);
}

describe("the person axis before and after an identity", () => {
  it("shows the person axis as anonymous until an identity is chosen", async () => {
    expect(await personRows()).toEqual(["absent"]);
    const text = await aidd([
      "report",
      "--from",
      "2026-10-07",
      "--to",
      "2026-10-08",
      "--axis",
      "person",
    ]);
    expect(text.stdout).toContain("anonymous");
    expect((await aidd(["identity"])).stdout).toContain("No identity is set");
  });

  it("carries nothing over from the previous version's identity file", async () => {
    await mkdir(userConfig, { recursive: true });
    await writeFile(join(userConfig, "identity.json"), '{"person_id":"old","origin":"prompt"}\n');
    await mkdir(box.telemetry, { recursive: true });
    await writeFile(
      join(box.telemetry, "identity.json"),
      '{"person_id":"old","origin":"prompt"}\n'
    );
    expect(await personRows()).toEqual(["absent"]);
  });
});
