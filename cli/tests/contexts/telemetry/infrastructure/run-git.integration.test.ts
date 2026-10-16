import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runGit } from "../../../../src/contexts/telemetry/infrastructure/run-git.js";
import { sandboxGitEnv } from "../../../helpers/git-sandbox.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "aidd-run-git-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("running git", () => {
  it("returns its output and a status of zero", () => {
    const run = runGit(sandboxGitEnv(dir), dir, ["--version"]);
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/^git version /);
  });

  it("returns a failure as a status, not as a throw", () => {
    const run = runGit(sandboxGitEnv(dir), dir, ["rev-parse", "--show-toplevel"]);
    expect(run.status).toBe(128);
    expect(run.stdout).toBe("");
  });

  it("takes each argument as it is: no shell reads them", () => {
    const run = runGit(sandboxGitEnv(dir), dir, ["config", "--get", "a.b;echo owned"]);
    expect(run.stdout).not.toContain("owned");
  });

  it("throws, naming the directory, when git cannot be started there", () => {
    expect(() => runGit(sandboxGitEnv(dir), join(dir, "missing"), ["--version"])).toThrow(
      `git could not be run in ${join(dir, "missing")}: `
    );
  });
});
