import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { cliPath, createTestEnv, sandboxedEnv } from "./helpers.js";

const execFileAsync = promisify(execFile);
async function runXdg(args: string[], cwd: string, home: string, xdg: string) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath(), ...args], {
      cwd,
      env: { ...sandboxedEnv(home), XDG_CONFIG_HOME: xdg },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string; code?: number };
    return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", exitCode: result.code ?? 1 };
  }
}

const fixture = resolve(process.cwd(), "tests/fixtures/framework-real");
const setup = [
  "setup",
  "--global",
  "--source",
  "local",
  "--path",
  fixture,
  "--ide",
  "opencode",
  "--plugins",
  "aidd-dev",
  "--yes",
];

describe("machine scope and XDG_CONFIG_HOME", () => {
  it.each(["opencode", "kilo"])("refuses non-standard XDG before installing %s", async (tool) => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("xdg-refusal");
    try {
      const args = [...setup];
      args[args.indexOf("opencode")] = tool;
      const result = await runXdg(args, projectDir, fakeHome, join(fakeHome, "other-config"));
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("XDG_CONFIG_HOME");
      expect(await readdir(projectDir)).toEqual([]);
      await expect(readdir(join(fakeHome, ".config", tool))).rejects.toThrow();
    } finally {
      await cleanup();
    }
  });

  it("permits default XDG, refuses refresh after it changes, and allows cleanup", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("xdg-clean");
    try {
      const normal = join(fakeHome, ".config");
      const other = join(fakeHome, "other-config");
      expect((await runXdg(setup, projectDir, fakeHome, normal)).exitCode).toBe(0);
      const sync = await runXdg(["sync", "--global"], projectDir, fakeHome, other);
      expect(sync.exitCode).not.toBe(0);
      expect(sync.stderr).toContain("XDG_CONFIG_HOME");
      const update = await runXdg(
        ["plugin", "update", "--scope", "user"],
        projectDir,
        fakeHome,
        other
      );
      expect(update.exitCode).not.toBe(0);
      expect(update.stderr).toContain("XDG_CONFIG_HOME");
      expect(
        (await runXdg(["clean", "--global", "--force"], projectDir, fakeHome, other)).exitCode
      ).toBe(0);
    } finally {
      await cleanup();
    }
  });
});
