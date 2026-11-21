import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../shared/testing/in-process-cli.builder.js";
import { setupFromFixture } from "../testing/fixture-setup.builder.js";
import { readJson } from "../testing/project-state.builder.js";

interface ProjectManifest {
  tools: Record<string, { files: Array<{ relativePath: string }> }>;
}

const MODIFIED = '{"MODIFIED":true}';

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("sync-in-process"));
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

/** Installs one tool, then overwrites the first file the manifest tracks. */
async function installAndModify(): Promise<string> {
  const setup = await aidd(setupFromFixture("claude", "none"));
  expect(setup.exitCode, setup.stderr).toBe(0);
  const manifest = await readJson<ProjectManifest>(join(project, ".aidd", "manifest.json"));
  const tracked = manifest.tools.claude?.files[0]?.relativePath;
  if (tracked === undefined) throw new Error("no tracked file to modify");
  await writeFile(join(project, tracked), MODIFIED, "utf-8");
  return tracked;
}

describe("sync over a modified tracked file without --force and without a terminal", () => {
  it("fails naming --force, claims no success, and leaves the file as it was", async () => {
    const tracked = await installAndModify();

    const { stdout, stderr, exitCode } = await aidd(["sync"]);

    expect(exitCode).not.toBe(0);
    expect(stdout).not.toContain("Nothing to restore");
    expect(`${stdout}${stderr}`).toContain("--force");
    expect(await readFile(join(project, tracked), "utf-8")).toBe(MODIFIED);
  });
});
