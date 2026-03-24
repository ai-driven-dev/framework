import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd setup", () => {
  it("shows usage with --help", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-help");
    try {
      const { stdout, exitCode } = await runCli(["setup", "--help"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("setup");
    } finally {
      await cleanup();
    }
  });

  it("needs-init state, non-interactive, no extra flags — succeeds with exit 0", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-init-noninteractive");
    try {
      const { exitCode } = await runCli(
        ["setup", "--path", FRAMEWORK_PATH, "--release", "test"],
        projectDir
      );

      expect(exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it("needs-adopt state, non-interactive, missing --from — exits 1 with error", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-adopt-no-from");
    try {
      // Create an AIDD signal file so detectSetupState returns needs-adopt
      const commandDir = join(projectDir, ".claude", "commands");
      await mkdir(commandDir, { recursive: true });
      await writeFile(
        join(commandDir, "implement.md"),
        "---\nname: aidd:04:implement\ndescription: test\n---\nbody"
      );

      const { stderr, exitCode } = await runCli(["setup", "--tools", "claude"], projectDir);

      expect(exitCode).toBe(1);
      expect(stderr.toLowerCase()).toMatch(/from|adopt/);
    } finally {
      await cleanup();
    }
  });
});
