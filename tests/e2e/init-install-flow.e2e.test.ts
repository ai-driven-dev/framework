import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd init + install flow", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-flow-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("installs multiple tools at once", async () => {
    const { stdout, exitCode } = await runCli(
      ["install", "claude", "cursor", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("claude");
    expect(stdout).toContain("cursor");
    expect(existsSync(join(projectDir, ".claude"))).toBe(true);
    expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
  }, 5000);

  it("installs claude cursor copilot in one command", async () => {
    const { stdout, exitCode } = await runCli(
      ["install", "claude", "cursor", "copilot", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("claude");
    expect(stdout).toContain("cursor");
    expect(stdout).toContain("copilot");
    expect(existsSync(join(projectDir, ".claude"))).toBe(true);
    expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    expect(existsSync(join(projectDir, ".github"))).toBe(true);
  }, 5000);

  it("manifest file hashes match actual file content MD5", async () => {
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const manifestRaw = await readFile(join(projectDir, ".aidd", "config.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw) as {
      tools: { claude: { files: { relativePath: string; hash: string }[] } };
    };

    const { createHash } = await import("node:crypto");
    for (const file of manifest.tools.claude.files) {
      const content = await readFile(join(projectDir, file.relativePath));
      const actualHash = createHash("md5").update(content).digest("hex");
      expect(actualHash).toBe(file.hash);
    }
  }, 5000);
});

describe("E2E: aidd version", () => {
  it("outputs version in correct format", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-version-"));
    try {
      const { stdout } = await runCli(["--version"], tempDir);
      expect(stdout.trim()).toMatch(/^aidd\/\d+\.\d+\.\d+ node\/\d+\.\d+\.\d+ \S+-\S+$/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 5000);
});
