import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryScriptUseCase,
  SCRIPT_RELATIVE_PATH,
} from "../../../src/application/use-cases/shared/memory-script-use-case.js";
import { InstallationFile } from "../../../src/domain/models/file.js";
import { FrameworkDescriptor } from "../../../src/domain/models/framework.js";
import { Manifest } from "../../../src/domain/models/manifest.js";
import type { Prompter } from "../../../src/domain/ports/prompter.js";
import type { VersionControl } from "../../../src/domain/ports/version-control.js";
import { buildDeps, cleanupTempProject, createTempProject } from "./helpers.js";

const SCRIPT_CONTENT = "// update memory script\nconsole.log('running');\n";
const VERSION = "1.0.0";
const SCRIPT_REF_PATH = "config/scripts/update_memory.js";

function makeDescriptor(): FrameworkDescriptor {
  return new FrameworkDescriptor({
    version: VERSION,
    contentSections: [],
    templateRefs: [],
    configRefs: [],
    scriptRefs: [{ name: "updateMemory", path: SCRIPT_REF_PATH, invocation: "node" }],
  });
}

function makeContentFiles(): Map<string, string> {
  return new Map([[SCRIPT_REF_PATH, SCRIPT_CONTENT]]);
}

function buildUseCase(
  deps: ReturnType<typeof buildDeps>,
  git: VersionControl,
  prompter?: Prompter
) {
  return new MemoryScriptUseCase(deps.fs, deps.hasher, git, prompter);
}

const HOOK_HEADER = "#!/bin/sh";

function makeGit(hooksDir: string | null): VersionControl {
  return {
    installPreCommitDelegate: async (_projectRoot: string, delegatePath: string) => {
      if (hooksDir === null) return;
      const hookPath = join(hooksDir, "pre-commit");
      const marker = `sh ${delegatePath}`;
      let content: string;
      try {
        content = await readFile(hookPath, "utf-8");
      } catch {
        content = `${HOOK_HEADER}\n`;
      }
      if (content.includes(marker)) return;
      if (!content.endsWith("\n")) content += "\n";
      content += `${marker}\n`;
      await mkdir(hooksDir, { recursive: true });
      await writeFile(hookPath, content, "utf-8");
      await chmod(hookPath, 0o755);
    },
  };
}

describe("memory script", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("writes the update_memory script to .aidd/scripts/", async () => {
    const deps = buildDeps(projectRoot);
    const manifest = Manifest.create();
    await buildUseCase(deps, makeGit(null)).execute({
      projectRoot,
      version: VERSION,
      descriptor: makeDescriptor(),
      contentFiles: makeContentFiles(),
      manifest,
    });

    const scriptPath = join(projectRoot, SCRIPT_RELATIVE_PATH);
    expect(existsSync(scriptPath)).toBe(true);
    expect(await readFile(scriptPath, "utf-8")).toBe(SCRIPT_CONTENT);
  });

  it("records the script in the manifest after writing", async () => {
    const deps = buildDeps(projectRoot);
    const manifest = Manifest.create();
    await buildUseCase(deps, makeGit(null)).execute({
      projectRoot,
      version: VERSION,
      descriptor: makeDescriptor(),
      contentFiles: makeContentFiles(),
      manifest,
    });

    expect(manifest.hasScripts()).toBe(true);
    expect(manifest.getScriptsVersion()).toBe(VERSION);
    const tracked = manifest.getScriptsFiles();
    expect(tracked.length).toBe(1);
    expect(tracked[0].relativePath).toBe(SCRIPT_RELATIVE_PATH);
  });

  it("skips re-writing the script when hash is unchanged", async () => {
    const deps = buildDeps(projectRoot);
    const manifest = Manifest.create();
    const useCase = buildUseCase(deps, makeGit(null));
    const descriptor = makeDescriptor();
    const contentFiles = makeContentFiles();

    await useCase.execute({
      projectRoot,
      version: VERSION,
      descriptor,
      contentFiles,
      manifest,
    });

    const scriptPath = join(projectRoot, SCRIPT_RELATIVE_PATH);
    const hashBefore = manifest.getScriptsFiles()[0].hash.value;

    // mutate the on-disk file to detect if it gets re-written
    await deps.fs.writeFile(scriptPath, "// tampered\n");

    await useCase.execute({
      projectRoot,
      version: VERSION,
      descriptor,
      contentFiles,
      manifest,
    });

    // file should NOT have been re-written (hash matched stored value)
    expect(await readFile(scriptPath, "utf-8")).toBe("// tampered\n");
    expect(manifest.getScriptsFiles()[0].hash.value).toBe(hashBefore);
  });

  it("always creates .aidd/hooks/pre-commit with correct shebang and node command", async () => {
    const deps = buildDeps(projectRoot);
    const manifest = Manifest.create();
    await buildUseCase(deps, makeGit(null)).execute({
      projectRoot,
      version: VERSION,
      descriptor: makeDescriptor(),
      contentFiles: makeContentFiles(),
      manifest,
    });

    const hookPath = join(projectRoot, ".aidd/hooks/pre-commit");
    expect(existsSync(hookPath)).toBe(true);
    const content = await readFile(hookPath, "utf-8");
    expect(content).toBe(`#!/bin/sh\nnode ${SCRIPT_RELATIVE_PATH}\n`);
  });

  it("overwrites .aidd/hooks/pre-commit on every run", async () => {
    const deps = buildDeps(projectRoot);
    const manifest = Manifest.create();
    const useCase = buildUseCase(deps, makeGit(null));
    const descriptor = makeDescriptor();
    const contentFiles = makeContentFiles();

    await useCase.execute({
      projectRoot,
      version: VERSION,
      descriptor,
      contentFiles,
      manifest,
    });

    const hookPath = join(projectRoot, ".aidd/hooks/pre-commit");
    await deps.fs.writeFile(hookPath, "stale content");

    await useCase.execute({
      projectRoot,
      version: VERSION,
      descriptor,
      contentFiles,
      manifest,
    });

    const content = await readFile(hookPath, "utf-8");
    expect(content).toBe(`#!/bin/sh\nnode ${SCRIPT_RELATIVE_PATH}\n`);
  });

  it("appends 'sh .aidd/hooks/pre-commit' to .git/hooks/pre-commit when hooks dir is provided", async () => {
    const deps = buildDeps(projectRoot);
    const manifest = Manifest.create();

    // create a fake git hooks dir inside the temp project
    const hooksDir = join(projectRoot, ".git", "hooks");
    await deps.fs.writeFile(join(hooksDir, ".gitkeep"), "");

    await buildUseCase(deps, makeGit(hooksDir)).execute({
      projectRoot,
      version: VERSION,
      descriptor: makeDescriptor(),
      contentFiles: makeContentFiles(),
      manifest,
    });

    const gitHookPath = join(hooksDir, "pre-commit");
    expect(existsSync(gitHookPath)).toBe(true);
    const content = await readFile(gitHookPath, "utf-8");
    expect(content).toContain("sh .aidd/hooks/pre-commit");
  });

  it("does not append the marker twice when run multiple times", async () => {
    const deps = buildDeps(projectRoot);
    const manifest = Manifest.create();
    const hooksDir = join(projectRoot, ".git", "hooks");
    await deps.fs.writeFile(join(hooksDir, ".gitkeep"), "");
    const useCase = buildUseCase(deps, makeGit(hooksDir));
    const descriptor = makeDescriptor();
    const contentFiles = makeContentFiles();

    await useCase.execute({
      projectRoot,
      version: VERSION,
      descriptor,
      contentFiles,
      manifest,
    });
    await useCase.execute({
      projectRoot,
      version: VERSION,
      descriptor,
      contentFiles,
      manifest,
    });

    const gitHookPath = join(hooksDir, "pre-commit");
    const content = await readFile(gitHookPath, "utf-8");
    const occurrences = (content.match(/sh \.aidd\/hooks\/pre-commit/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("appends to an existing .git/hooks/pre-commit without erasing its content", async () => {
    const deps = buildDeps(projectRoot);
    const manifest = Manifest.create();
    const hooksDir = join(projectRoot, ".git", "hooks");
    const gitHookPath = join(hooksDir, "pre-commit");
    await deps.fs.writeFile(gitHookPath, "#!/bin/sh\nexisting-command\n");

    await buildUseCase(deps, makeGit(hooksDir)).execute({
      projectRoot,
      version: VERSION,
      descriptor: makeDescriptor(),
      contentFiles: makeContentFiles(),
      manifest,
    });

    const content = await readFile(gitHookPath, "utf-8");
    expect(content).toContain("existing-command");
    expect(content).toContain("sh .aidd/hooks/pre-commit");
  });

  it("skips .git/hooks installation when git resolves to null", async () => {
    const deps = buildDeps(projectRoot);
    const manifest = Manifest.create();
    await buildUseCase(deps, makeGit(null)).execute({
      projectRoot,
      version: VERSION,
      descriptor: makeDescriptor(),
      contentFiles: makeContentFiles(),
      manifest,
    });

    expect(existsSync(join(projectRoot, ".git", "hooks", "pre-commit"))).toBe(false);
  });
});

describe("obsolete script removal", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  async function makeManifestWithStaleScript(
    deps: ReturnType<typeof buildDeps>,
    stalePath: string,
    staleContent: string
  ): Promise<Manifest> {
    const manifest = Manifest.create();
    const staleAbsPath = join(projectRoot, stalePath);
    await deps.fs.writeFile(staleAbsPath, staleContent);
    const hash = await deps.fs.readFileHash(staleAbsPath);
    manifest.addScripts(VERSION, [
      new InstallationFile({ relativePath: stalePath, content: staleContent, hash }),
    ]);
    return manifest;
  }

  it("removes an obsolete script that was not locally modified", async () => {
    const deps = buildDeps(projectRoot);
    const stalePath = ".aidd/scripts/update_memory.mjs";
    const manifest = await makeManifestWithStaleScript(deps, stalePath, SCRIPT_CONTENT);

    await buildUseCase(deps, makeGit(null)).execute({
      projectRoot,
      version: VERSION,
      descriptor: makeDescriptor(),
      contentFiles: makeContentFiles(),
      manifest,
    });

    expect(existsSync(join(projectRoot, stalePath))).toBe(false);
    expect(existsSync(join(projectRoot, SCRIPT_RELATIVE_PATH))).toBe(true);
  });

  it("removes an obsolete script after user confirms when locally modified", async () => {
    const deps = buildDeps(projectRoot);
    const stalePath = ".aidd/scripts/update_memory.mjs";
    const manifest = await makeManifestWithStaleScript(deps, stalePath, SCRIPT_CONTENT);

    // Tamper the stale file to simulate a local modification
    await deps.fs.writeFile(join(projectRoot, stalePath), "// user modification\n");

    const prompter: Prompter = { confirm: vi.fn().mockResolvedValue(true) } as unknown as Prompter;

    await buildUseCase(deps, makeGit(null), prompter).execute({
      projectRoot,
      version: VERSION,
      descriptor: makeDescriptor(),
      contentFiles: makeContentFiles(),
      manifest,
    });

    expect(prompter.confirm).toHaveBeenCalledOnce();
    expect(existsSync(join(projectRoot, stalePath))).toBe(false);
  });

  it("preserves an obsolete script when user declines removal of a locally modified file", async () => {
    const deps = buildDeps(projectRoot);
    const stalePath = ".aidd/scripts/update_memory.mjs";
    const manifest = await makeManifestWithStaleScript(deps, stalePath, SCRIPT_CONTENT);

    await deps.fs.writeFile(join(projectRoot, stalePath), "// user modification\n");

    const prompter: Prompter = { confirm: vi.fn().mockResolvedValue(false) } as unknown as Prompter;

    await buildUseCase(deps, makeGit(null), prompter).execute({
      projectRoot,
      version: VERSION,
      descriptor: makeDescriptor(),
      contentFiles: makeContentFiles(),
      manifest,
    });

    expect(prompter.confirm).toHaveBeenCalledOnce();
    expect(existsSync(join(projectRoot, stalePath))).toBe(true);
  });

  it("silently removes an obsolete locally modified script in non-interactive mode", async () => {
    const deps = buildDeps(projectRoot);
    const stalePath = ".aidd/scripts/update_memory.mjs";
    const manifest = await makeManifestWithStaleScript(deps, stalePath, SCRIPT_CONTENT);

    await deps.fs.writeFile(join(projectRoot, stalePath), "// user modification\n");

    await buildUseCase(deps, makeGit(null)).execute({
      projectRoot,
      version: VERSION,
      descriptor: makeDescriptor(),
      contentFiles: makeContentFiles(),
      manifest,
    });

    expect(existsSync(join(projectRoot, stalePath))).toBe(false);
  });
});
