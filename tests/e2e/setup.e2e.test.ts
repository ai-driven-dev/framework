import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

// Note: aidd setup is intentionally interactive-only (TTY guard at entry).
// Since runCli spawns a subprocess without a TTY, all state-branch flows
// (needs-init, needs-adopt, needs-install, needs-update, up-to-date) cannot
// be tested via E2E. State detection is covered by SetupUseCase unit tests.

describe.concurrent("E2E: aidd setup", () => {
  it("exits 1 with error when stdout is not a TTY (non-interactive mode)", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-non-tty");
    try {
      const { stderr, exitCode } = await runCli(["setup"], projectDir);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("requires an interactive TTY");
    } finally {
      await cleanup();
    }
  });

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
});
