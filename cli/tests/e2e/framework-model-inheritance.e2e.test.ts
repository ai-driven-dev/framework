import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { frameworkBuildTargetModes } from "../../src/contexts/translate/domain/build-target.js";
import "../../src/runtime/wiring/translate.js";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import { createTestEnv, runCli } from "./helpers.js";

// Every target/mode the CLI announces, built from the shipped plugins rather than a fixture.
const CELLS = frameworkBuildTargetModes();

// A recipe may show a model in an example block; only a declaration the host reads counts.
function overridesModel(path: string, content: string): boolean {
  if (path.endsWith(".toml")) return /^model\s*=/m.test(content);
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return frontmatter !== null && /^model\s*:/m.test(frontmatter[1]);
}

describe.concurrent("E2E: the shipped framework leaves model selection to the host", () => {
  it.each(CELLS)(
    "$target $mode emits no model override",
    async ({ target, mode }) => {
      const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv(
        `model-${target}-${mode}`
      );
      try {
        const outDir = join(tempDir, "dist");
        await mkdir(outDir, { recursive: true });
        const args = ["translate", REPOSITORY_ROOT, "--to", target, "--out", outDir, "--as", mode];
        const build = await runCli(args, projectDir, fakeHome);
        expect(build.exitCode, build.stderr).toBe(0);

        const files = await readdir(outDir, { recursive: true, withFileTypes: true });
        const emitted = files.filter((entry) => entry.isFile());
        expect(emitted.length).toBeGreaterThan(0);
        const overrides: string[] = [];
        for (const entry of emitted) {
          const path = join(entry.parentPath, entry.name);
          if (overridesModel(path, await readFile(path, "utf-8"))) {
            overrides.push(path.slice(outDir.length));
          }
        }
        expect(overrides).toEqual([]);
      } finally {
        await cleanup();
      }
    },
    120_000
  );
});
