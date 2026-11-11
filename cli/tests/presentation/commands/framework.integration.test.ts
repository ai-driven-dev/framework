import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../e2e/helpers.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import { seedEmptyManifest } from "../../helpers/project-state.js";

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("framework-in-process"));
  await seedEmptyManifest(project);
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

/** Overwrites the first file the manifest tracks for a tool, as a person editing it would. */
async function editFirstTrackedFile(toolId: string): Promise<void> {
  const raw = await readFile(join(project, ".aidd", "manifest.json"), "utf-8");
  const manifest = JSON.parse(raw) as {
    tools: Record<string, { files: Array<{ relativePath: string }> }>;
  };
  const first = manifest.tools[toolId]?.files[0];
  if (!first) throw new Error(`No ${toolId} files in manifest: the install may have failed`);
  const path = join(project, first.relativePath);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, "user-modified content for conflict test");
}

describe("framework install into a project with no tool yet", () => {
  it("writes the .cursor directory from the bundled assets for cursor", async () => {
    const { stdout, exitCode } = await aidd(["framework", "install", "--tool", "cursor"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Installed cursor");
    expect(existsSync(join(project, ".cursor"))).toBe(true);
  });
});

describe("framework update of an installed editor tool whose tracked file was edited", () => {
  beforeEach(async () => {
    await aidd(["framework", "install", "--tool", "vscode"]);
    await editFirstTrackedFile("vscode");
  });

  it("exits 1 and asks for --force when there is no terminal to ask in", async () => {
    const { exitCode, stderr } = await aidd(["framework", "update", "--tool", "vscode"]);

    expect(exitCode).toBe(1);
    expect(stderr.toLowerCase()).toMatch(/force|non-interactive/);
  });

  it("exits 0 with --force", async () => {
    const { exitCode } = await aidd(["framework", "update", "--tool", "vscode", "--force"]);

    expect(exitCode).toBe(0);
  });
});
