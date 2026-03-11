import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd adopt", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-adopt-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("shows usage with --help", async () => {
    const { stdout, exitCode } = await runCli(["adopt", "--help"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("--tools");
    expect(stdout).toContain("--docs-dir");
  }, 10000);

  it("fails when --release is missing", async () => {
    const { exitCode, stderr } = await runCli(["adopt", "--tools", "claude"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("--release");
  }, 10000);

  it("fails when --tools is missing", async () => {
    const { exitCode, stderr } = await runCli(["--release", "3.3.3", "adopt"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("--tools");
  }, 10000);

  it("fails with unknown tool name", async () => {
    const { exitCode, stderr } = await runCli(
      ["--release", "3.3.3", "adopt", "--tools", "unknown-tool"],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Unknown tool");
  }, 10000);

  it("fails when specified tool directory does not exist", async () => {
    const { exitCode, stderr } = await runCli(
      ["--release", "3.3.3", "adopt", "--tools", "claude"],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain(".claude/");
  }, 10000);

  it("fails with 'Already initialized' when manifest already exists", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { exitCode, stderr } = await runCli(
      ["--release", "3.3.3", "adopt", "--tools", "claude"],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Already initialized");
  }, 15000);

  it("creates manifest from manually installed .claude/ files", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

    const { stdout, exitCode } = await runCli(
      ["--release", "test", "adopt", "--tools", "claude"],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Adopted");
    expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
  }, 15000);

  it("status shows no drift after adopt (manifest hash matches disk)", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

    await runCli(["--release", "test", "adopt", "--tools", "claude"], projectDir);

    const { stdout, exitCode } = await runCli(
      ["status", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("in sync");
  }, 20000);

  it("adopts multiple tools (claude + cursor) when specified", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);
    await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

    const { stdout, exitCode } = await runCli(
      ["--release", "test", "adopt", "--tools", "claude,cursor"],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("2 tool(s)");

    const manifest = JSON.parse(
      await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8")
    ) as { tools: Record<string, unknown> };
    expect(manifest.tools.claude).toBeDefined();
    expect(manifest.tools.cursor).toBeDefined();
  }, 20000);

  it("adopts all three tools (claude + cursor + copilot) when specified", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "copilot", "--framework", FRAMEWORK_PATH], projectDir);
    await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

    const { stdout, exitCode } = await runCli(
      ["--release", "test", "adopt", "--tools", "claude,cursor,copilot"],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("3 tool(s)");

    const manifest = JSON.parse(
      await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8")
    ) as { tools: Record<string, unknown> };
    expect(manifest.tools.claude).toBeDefined();
    expect(manifest.tools.cursor).toBeDefined();
    expect(manifest.tools.copilot).toBeDefined();
  }, 20000);

  it("deletes legacy config.json during adoption", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await rm(join(projectDir, ".aidd", "manifest.json"));
    await writeFile(join(projectDir, ".aidd", "config.json"), "{}");

    await runCli(["--release", "test", "adopt", "--tools", "claude"], projectDir);

    expect(existsSync(join(projectDir, ".aidd", "config.json"))).toBe(false);
    expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
  }, 15000);
});
