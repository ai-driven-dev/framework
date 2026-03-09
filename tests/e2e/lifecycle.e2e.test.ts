import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: full lifecycle — init → install → status → uninstall → clean", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-lifecycle-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("completes the full install, status, uninstall, clean cycle", async () => {
    // init
    const initResult = await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    expect(initResult.exitCode).toBe(0);

    // install claude
    const installResult = await runCli(
      ["install", "claude", "--framework", FRAMEWORK_PATH],
      projectDir
    );
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stdout).toContain("Installed claude");

    // status — in sync
    const statusResult = await runCli(["status"], projectDir);
    expect(statusResult.exitCode).toBe(0);
    expect(statusResult.stdout).toContain("All files are in sync");

    // uninstall
    const uninstallResult = await runCli(["uninstall", "claude"], projectDir);
    expect(uninstallResult.exitCode).toBe(0);
    expect(uninstallResult.stdout).toContain("Uninstalled claude");
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);

    // clean --force
    const cleanResult = await runCli(["clean", "--force"], projectDir);
    expect(cleanResult.exitCode).toBe(0);
    expect(cleanResult.stdout).toContain("Cleaned all AIDD files");
    expect(existsSync(join(projectDir, ".aidd"))).toBe(false);
  }, 5000);
});
