import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInProcess } from "../../helpers/in-process-cli.js";

let root: string;
let project: string;
let home: string;
let userConfig: string;
let emptyPath: string;

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "aidd-auth-command-")));
  project = join(root, "project");
  home = join(root, "home");
  userConfig = join(root, "user-config");
  emptyPath = join(root, "empty-path");
  for (const dir of [project, home, userConfig, emptyPath]) await mkdir(dir, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function aidd(args: string[]) {
  return runInProcess(["auth", ...args], {
    cwd: project,
    home,
    env: { AIDD_TOKEN: "", AIDD_USER_CONFIG_DIR: userConfig, PATH: emptyPath },
  });
}

async function seed(file: string, level: "project" | "user"): Promise<void> {
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      method: "stored",
      level,
      token: "ghp_seeded",
      createdAt: "1970-01-01T00:00:00.000Z",
    })
  );
}

const projectFile = (): string => join(project, ".aidd", "auth.json");
const userFile = (): string => join(userConfig, "auth.json");

describe("auth through the real wiring", () => {
  describe("logging out with a record at both levels", () => {
    it("removes the project record and leaves the user one", async () => {
      await seed(projectFile(), "project");
      await seed(userFile(), "user");

      const result = await aidd(["logout"]);

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain("Logged out (project)");
      expect(existsSync(projectFile())).toBe(false);
      expect(existsSync(userFile())).toBe(true);
    });
  });

  describe("logging out with a user record only", () => {
    it("removes the record kept under the user configuration directory", async () => {
      await seed(userFile(), "user");

      const result = await aidd(["logout"]);

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain("Logged out (user)");
      expect(existsSync(userFile())).toBe(false);
    });
  });

  describe("logging in through gh when no gh can be run", () => {
    it.skipIf(process.platform === "win32")(
      "fails naming the gh CLI and writes no record",
      async () => {
        const result = await aidd(["login", "--gh", "--level", "project"]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Authentication failed (gh CLI)");
        expect(existsSync(projectFile())).toBe(false);
      }
    );
  });
});
