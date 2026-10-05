import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const FRAMEWORK_REAL_PATH = resolve(process.cwd(), "tests/fixtures/framework-real");
const OWN_SKILL = "aidd-vcs-01-commit/SKILL.md";
const FOREIGN_SKILL = "# mine\n";

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
});
