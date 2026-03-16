import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd self-update", () => {
  it("shows help with expected flags", async () => {
    const { projectDir, cleanup } = await createTestEnv("self-update");
    try {
      const { stdout, exitCode } = await runCli(["self-update", "--help"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("self-update");
      expect(stdout).toContain("--check");
      expect(stdout).toContain("--dry-run");
      expect(stdout).toContain("--force");
    } finally {
      await cleanup();
    }
  });
});
