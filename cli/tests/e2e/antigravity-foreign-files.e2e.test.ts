import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const FRAMEWORK_REAL_PATH = resolve(process.cwd(), "tests/fixtures/framework-real");
const OWN_SKILL = "aidd-vcs-01-commit/SKILL.md";
const FOREIGN_SKILL = "# mine\n";
const OWN_HOOKED_SKILL = "aidd-context-05-learn/SKILL.md";
const FOREIGN_HOOK = { SessionStart: [{ type: "command", command: "echo lint" }] };

describe("E2E: antigravity under a .agents/ it does not own", () => {
  it("clean removes the skills it wrote and leaves a user skill beside them", async () => {
    const test = await createTestEnv("clean-antigravity-foreign");
    try {
      const skills = join(test.projectDir, ".agents", "skills");
      const foreign = join(skills, "mine", "SKILL.md");
      await mkdir(join(skills, "mine"), { recursive: true });
      await writeFile(foreign, FOREIGN_SKILL);

      const setup = await runCli(
        [
          "setup",
          "--source",
          "local",
          "--path",
          FRAMEWORK_REAL_PATH,
          "--ai",
          "antigravity",
          "--plugins",
          "aidd-vcs",
          "--yes",
        ],
        test.projectDir,
        test.fakeHome
      );
      expect(setup.exitCode).toBe(0);
      expect(existsSync(join(skills, OWN_SKILL))).toBe(true);

      const clean = await runCli(["clean", "--force"], test.projectDir, test.fakeHome);

      expect(clean.exitCode).toBe(0);
      expect(existsSync(join(skills, OWN_SKILL))).toBe(false);
      expect(await readFile(foreign, "utf-8")).toBe(FOREIGN_SKILL);
    } finally {
      await test.cleanup();
    }
  });

  it("sync --force restores a drifted skill it wrote and leaves a user skill and a user named hook as they were", async () => {
    const test = await createTestEnv("sync-antigravity-foreign");
    try {
      const skills = join(test.projectDir, ".agents", "skills");
      const hooksFile = join(test.projectDir, ".agents", "hooks.json");
      const foreign = join(skills, "mine", "SKILL.md");
      const own = join(skills, OWN_HOOKED_SKILL);

      const setup = await runCli(
        [
          "setup",
          "--source",
          "local",
          "--path",
          FRAMEWORK_REAL_PATH,
          "--ai",
          "antigravity",
          "--plugins",
          "aidd-context",
          "--yes",
        ],
        test.projectDir,
        test.fakeHome
      );
      expect(setup.exitCode).toBe(0);
      const installed = await readFile(own, "utf-8");
      const hooks = JSON.parse(await readFile(hooksFile, "utf-8"));
      expect(Object.keys(hooks)).toEqual(["aidd-context"]);
      await writeFile(hooksFile, JSON.stringify({ ...hooks, lint: FOREIGN_HOOK }, null, 2));
      await mkdir(join(skills, "mine"), { recursive: true });
      await writeFile(foreign, FOREIGN_SKILL);
      await writeFile(own, `${installed}drift\n`);

      const sync = await runCli(["sync", "--force"], test.projectDir, test.fakeHome);

      expect(sync.exitCode).toBe(0);
      expect(await readFile(own, "utf-8")).toBe(installed);
      expect(await readFile(foreign, "utf-8")).toBe(FOREIGN_SKILL);
      // Restore unmerges then remerges its own key, so key order may move; content may not.
      const restored = JSON.parse(await readFile(hooksFile, "utf-8"));
      expect(restored).toEqual({ ...hooks, lint: FOREIGN_HOOK });
    } finally {
      await test.cleanup();
    }
  });
});
