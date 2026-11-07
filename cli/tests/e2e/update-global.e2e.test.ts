import { describe, expect, it } from "vitest";
import { seedEmptyManifest } from "../helpers/project-state.js";
import { createTestEnv, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd framework update", () => {
  it("reports all tools up to date when no tools have drift", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("update-noop");
    try {
      await seedEmptyManifest(projectDir);
      await runCli(["framework", "install", "--tool", "claude"], projectDir, fakeHome);

      const { stdout, exitCode } = await runCli(["framework", "update"], projectDir, fakeHome);

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/up to date|updated/);
    } finally {
      await cleanup();
    }
  });
});
