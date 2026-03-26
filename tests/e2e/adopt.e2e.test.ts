import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd setup (adopt flow)", () => {
  it("detects pre-existing AIDD files and registers them without overwriting", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt-detect");
    try {
      // Create a signal file that triggers needs-adopt detection
      const commandsDir = join(projectDir, ".claude", "commands");
      await mkdir(commandsDir, { recursive: true });
      const commandContent =
        "---\nname: aidd:04:implement\ndescription: implement feature\n---\nbody";
      await writeFile(join(commandsDir, "implement.md"), commandContent);

      const { stdout, exitCode } = await runCli(
        ["setup", "--tools", "claude", "--from", FRAMEWORK_PATH, "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/adopt/);

      // Original file must not have been overwritten
      const content = await readFile(join(commandsDir, "implement.md"), "utf-8");
      expect(content).toBe(commandContent);

      // Manifest must exist after adoption
      expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("fails in non-interactive mode without --tools flag when adopt state is detected", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt-noninteractive-no-tools");
    try {
      // Create a signal file that triggers needs-adopt detection
      const commandsDir = join(projectDir, ".claude", "commands");
      await mkdir(commandsDir, { recursive: true });
      await writeFile(
        join(commandsDir, "implement.md"),
        "---\nname: aidd:04:implement\ndescription: test\n---\nbody"
      );

      // No --tools flag in non-interactive mode — should fail
      const { stderr, exitCode } = await runCli(["setup", "--path", FRAMEWORK_PATH], projectDir);

      expect(exitCode).toBe(1);
      expect(stderr.toLowerCase()).toMatch(/tools|non-interactive/);
    } finally {
      await cleanup();
    }
  });

  it("fails in non-interactive mode without --from flag when adopt state is detected", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt-noninteractive-no-from");
    try {
      // Create a signal file that triggers needs-adopt detection
      const commandsDir = join(projectDir, ".claude", "commands");
      await mkdir(commandsDir, { recursive: true });
      await writeFile(
        join(commandsDir, "implement.md"),
        "---\nname: aidd:04:implement\ndescription: test\n---\nbody"
      );

      // --tools is provided but --from is missing — should fail with error about --from
      const { stderr, exitCode } = await runCli(
        ["setup", "--tools", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(1);
      expect(stderr.toLowerCase()).toMatch(/from|adopt/);
    } finally {
      await cleanup();
    }
  });

  it("adopts multiple tools from a local framework path", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt-multi-tools");
    try {
      // Create signal files for claude tool
      const commandsDir = join(projectDir, ".claude", "commands");
      await mkdir(commandsDir, { recursive: true });
      await writeFile(
        join(commandsDir, "implement.md"),
        "---\nname: aidd:04:implement\ndescription: implement feature\n---\nbody"
      );

      // Also create copilot directory so AdoptUseCase does not throw "Directory not found"
      const copilotDir = join(projectDir, ".github");
      await mkdir(copilotDir, { recursive: true });
      await writeFile(join(copilotDir, "copilot-instructions.md"), "# Copilot Instructions");

      const { stdout, exitCode } = await runCli(
        ["setup", "--tools", "claude,copilot", "--from", FRAMEWORK_PATH, "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/adopt/);

      // Manifest must record both tools
      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as {
        tools: Record<string, unknown>;
      };
      expect(Object.keys(manifest.tools)).toContain("claude");
      expect(Object.keys(manifest.tools)).toContain("copilot");
    } finally {
      await cleanup();
    }
  });
});
