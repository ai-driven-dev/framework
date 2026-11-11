import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../e2e/helpers.js";
import { FRAMEWORK_REAL, setupFromFixture } from "../../helpers/fixture-setup.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import { readJson, seedEmptyManifest } from "../../helpers/project-state.js";

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("plugin-in-process"));
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

describe("plugin install against a registered marketplace", () => {
  it("refuses a version the catalog does not declare", async () => {
    await seedEmptyManifest(project);
    await aidd(["framework", "install", "--tool", "claude"]);
    await aidd(["marketplace", "add", "fixture-market", FRAMEWORK_REAL, "--yes"]);

    const { exitCode, stderr } = await aidd([
      "plugin",
      "install",
      "aidd-dev@0.9.0",
      "--tool",
      "claude",
    ]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("does not match catalog version");
  });

  it("tracks the installed plugin in the manifest after a setup without plugins", async () => {
    await aidd(setupFromFixture("claude", "none"));

    const { stdout, exitCode } = await aidd([
      "plugin",
      "install",
      "aidd-context",
      "--tool",
      "claude",
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("aidd-context");
    const manifest = await readJson<{
      tools: Record<string, { plugins?: Array<{ name: string }> }>;
    }>(join(project, ".aidd", "manifest.json"));
    const installed = (manifest.tools.claude?.plugins ?? []).find((p) => p.name === "aidd-context");
    expect(installed).toBeDefined();
  });
});
