import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInProcess } from "../shared/testing/in-process-cli.builder.js";

const CORRUPTED = '{"version": 9, "tools": "x"}';

let root: string;
let project: string;
let home: string;

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "aidd-clean-corrupted-")));
  project = join(root, "project");
  home = join(root, "home");
  await mkdir(join(project, ".aidd"), { recursive: true });
  await mkdir(join(home, ".config", "aidd"), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("the recovery a corrupted manifest message names", () => {
  it("names the corrupted project manifest, and deleting it lets the command run", async () => {
    const manifest = join(project, ".aidd", "manifest.json");
    await writeFile(manifest, CORRUPTED);

    const refused = await runInProcess(["sync"], { cwd: project, home });

    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain(manifest);
    expect(refused.stderr).not.toContain("clean --force");

    await rm(manifest);

    const after = await runInProcess(["sync"], { cwd: project, home });
    expect(after.stderr).toContain("No AIDD manifest found");
  });

  it("names the corrupted user-scope manifest, and deleting it lets the command run", async () => {
    const manifest = join(home, ".config", "aidd", "manifest.json");
    await writeFile(manifest, CORRUPTED);

    const refused = await runInProcess(["sync", "--global"], { cwd: project, home });

    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain(manifest);

    await rm(manifest);

    expect((await runInProcess(["sync", "--global"], { cwd: project, home })).exitCode).toBe(0);
  });
});
