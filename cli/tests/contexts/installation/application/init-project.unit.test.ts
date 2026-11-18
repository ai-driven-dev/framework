import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InitProject } from "../../../../src/contexts/installation/application/init-project.js";
import { buildUnitDeps, initProject, installTool } from "../../../helpers/ports/build-unit-deps.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";

const PROJECT_ROOT = "/test-project";

function countingLoads(repo: { load: () => Promise<unknown> }): () => number {
  let reads = 0;
  const load = repo.load.bind(repo);
  repo.load = async () => {
    reads += 1;
    return load();
  };
  return () => reads;
}

describe("init", () => {
  it("reads the manifest once, whether it initializes or refuses", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    const reads = countingLoads(deps.manifestRepo);
    const init = new InitProject(deps.fs, deps.manifestRepo);
    const command = { projectRoot: PROJECT_ROOT, tools: registeredTools() };

    await init.execute(command);
    expect(reads()).toBe(1);

    await init.execute(command).catch(() => undefined);
    expect(reads()).toBe(2);
  });

  it("reads the manifest once when it initializes only if absent", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    const reads = countingLoads(deps.manifestRepo);

    await new InitProject(deps.fs, deps.manifestRepo).initializeIfAbsent({
      projectRoot: PROJECT_ROOT,
      tools: registeredTools(),
    });

    expect(reads()).toBe(1);
  });

  it("creates a v5 manifest with no tools", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    const result = await new InitProject(deps.fs, deps.manifestRepo).execute({
      projectRoot: PROJECT_ROOT,
      tools: registeredTools(),
    });

    expect(result.manifest).not.toBeNull();

    const manifest = await deps.manifestRepo.load();
    expect(manifest).not.toBeNull();
    expect(result.manifest.toJSON()).toEqual(manifest?.toJSON());
    expect(deps.fs.getFile(join(PROJECT_ROOT, ".gitignore"))).toContain(".aidd/cache/");
    const tools = manifest?.getInstalledToolIds() ?? [];
    expect(tools).toHaveLength(0);
  });

  it("does not create an aidd_docs directory", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await new InitProject(deps.fs, deps.manifestRepo).execute({
      projectRoot: PROJECT_ROOT,
      tools: registeredTools(),
    });

    const docsFiles = deps.fs.listUnder(join(PROJECT_ROOT, "aidd_docs"));
    expect(docsFiles).toHaveLength(0);
  });

  it("does not overwrite a pre-existing user file", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    const docFile = join(PROJECT_ROOT, ".claude", "CLAUDE.md");
    await deps.fs.writeFile(docFile, "custom content");

    await new InitProject(deps.fs, deps.manifestRepo).execute({
      projectRoot: PROJECT_ROOT,
      tools: registeredTools(),
    });

    expect(deps.fs.getFile(docFile)).toBe("custom content");
  });

  describe("initializeIfAbsent", () => {
    it("creates the manifest and answers true when none exists", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);

      const created = await new InitProject(deps.fs, deps.manifestRepo).initializeIfAbsent({
        projectRoot: PROJECT_ROOT,
        tools: registeredTools(),
      });

      expect(created).toBe(true);
      expect(await deps.manifestRepo.load()).not.toBeNull();
    });

    it("leaves an existing manifest alone and answers false", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      const before = deps.manifestRepo.saveCount;

      const created = await new InitProject(deps.fs, deps.manifestRepo).initializeIfAbsent({
        projectRoot: PROJECT_ROOT,
        tools: registeredTools(),
      });

      expect(created).toBe(false);
      expect(deps.manifestRepo.saveCount).toBe(before);
    });
  });

  describe("execute refuses a project that cannot be initialized", () => {
    it("aborts with guidance when .claude/ contains AIDD frontmatter", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await deps.fs.writeFile(
        join(PROJECT_ROOT, ".claude", "commands", "aidd", "02", "brainstorm.md"),
        "---\nname: aidd:02:brainstorm\ndescription: test\n---\nbody"
      );

      await expect(
        new InitProject(deps.fs, deps.manifestRepo).execute({
          projectRoot: PROJECT_ROOT,
          tools: registeredTools(),
        })
      ).rejects.toThrow("AIDD files detected but no manifest found");
    });

    it("passes when .claude/ exists without AIDD frontmatter", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await deps.fs.writeFile(
        join(PROJECT_ROOT, ".claude", "commands", "my-command.md"),
        "---\nname: my-command\ndescription: custom\n---\nbody"
      );

      await expect(
        new InitProject(deps.fs, deps.manifestRepo).execute({
          projectRoot: PROJECT_ROOT,
          tools: registeredTools(),
        })
      ).resolves.toHaveProperty("manifest");
    });

    it("aborts when already initialized without --force", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await new InitProject(deps.fs, deps.manifestRepo).execute({
        projectRoot: PROJECT_ROOT,
        tools: registeredTools(),
      });
      await expect(
        new InitProject(deps.fs, deps.manifestRepo).execute({
          projectRoot: PROJECT_ROOT,
          tools: registeredTools(),
        })
      ).rejects.toThrow(/Already initialized/);
    });

    // `aidd init` is not a command this CLI exposes (see the surface in cli.md) — telling
    // a user to run `aidd init --force` points them at something that does not exist.
    it("names a real recovery path, not the nonexistent `aidd init --force`", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await new InitProject(deps.fs, deps.manifestRepo).execute({
        projectRoot: PROJECT_ROOT,
        tools: registeredTools(),
      });
      await expect(
        new InitProject(deps.fs, deps.manifestRepo).execute({
          projectRoot: PROJECT_ROOT,
          tools: registeredTools(),
        })
      ).rejects.toThrow(/aidd clean --force/);
      await expect(
        new InitProject(deps.fs, deps.manifestRepo).execute({
          projectRoot: PROJECT_ROOT,
          tools: registeredTools(),
        })
      ).rejects.not.toThrow(/aidd init --force/);
    });

    it("--force: fails with guidance when no manifest exists", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await expect(
        new InitProject(deps.fs, deps.manifestRepo).execute({
          projectRoot: PROJECT_ROOT,
          force: true,
          tools: registeredTools(),
        })
      ).rejects.toThrow("No AIDD manifest found");
    });

    it("--force: passes when manifest exists", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await new InitProject(deps.fs, deps.manifestRepo).execute({
        projectRoot: PROJECT_ROOT,
        tools: registeredTools(),
      });
      await expect(
        new InitProject(deps.fs, deps.manifestRepo).execute({
          projectRoot: PROJECT_ROOT,
          force: true,
          tools: registeredTools(),
        })
      ).resolves.toHaveProperty("manifest");
    });
  });

  describe("--force", () => {
    it("does not create or alter gitignore while reusing an existing manifest", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await deps.fs.writeFile(join(PROJECT_ROOT, ".gitignore"), "# User-owned\n");
      const before = (await deps.manifestRepo.load())?.toJSON();
      const result = await new InitProject(deps.fs, deps.manifestRepo).execute({
        projectRoot: PROJECT_ROOT,
        force: true,
        tools: registeredTools(),
      });
      expect(result.manifest.toJSON()).toEqual(before);
      expect(deps.fs.getFile(join(PROJECT_ROOT, ".gitignore"))).toBe("# User-owned\n");
    });

    it("preserves existing manifest tools when --force reinitializes", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.claude);

      const manifestBefore = await deps.manifestRepo.load();
      const toolsBefore = manifestBefore?.getInstalledToolIds() ?? [];

      await new InitProject(deps.fs, deps.manifestRepo).execute({
        projectRoot: PROJECT_ROOT,
        force: true,
        tools: registeredTools(),
      });

      const manifestAfter = await deps.manifestRepo.load();
      const toolsAfter = manifestAfter?.getInstalledToolIds() ?? [];
      expect(toolsAfter).toEqual(toolsBefore);
    });
  });
});
