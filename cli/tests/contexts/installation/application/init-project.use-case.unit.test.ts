import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InitProject } from "../../../../src/contexts/installation/application/init-project.use-case.js";
import {
  buildInstallationDeps,
  initProject,
  installTool,
} from "../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../shared/testing/saying.builder.js";

const PROJECT_ROOT = "/test-project";

function initOf(deps: Awaited<ReturnType<typeof buildInstallationDeps>>): InitProject {
  return new InitProject(
    { fs: deps.fs, manifestRepo: deps.manifestRepo, updateGitignore: deps.updateGitignore },
    registeredTools()
  );
}

function countingLoads(repo: { load: () => Promise<unknown> }): () => number {
  let reads = 0;
  const load = repo.load.bind(repo);
  repo.load = async () => {
    reads += 1;
    return load();
  };
  return () => reads;
}

describe("initializing a project", () => {
  it("reads the manifest once, whether it initializes or refuses", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    const reads = countingLoads(deps.manifestRepo);
    const init = initOf(deps);
    const command = { projectRoot: PROJECT_ROOT };

    await init.execute(command);
    expect(reads()).toBe(1);

    await init.execute(command).catch(() => undefined);
    expect(reads()).toBe(2);
  });

  it("reads the manifest once when it initializes only if absent", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    const reads = countingLoads(deps.manifestRepo);

    await initOf(deps).initializeIfAbsent({
      projectRoot: PROJECT_ROOT,
    });

    expect(reads()).toBe(1);
  });

  it("creates a v5 manifest with no tools", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    const result = await initOf(deps).execute({
      projectRoot: PROJECT_ROOT,
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
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initOf(deps).execute({
      projectRoot: PROJECT_ROOT,
    });

    const docsFiles = deps.fs.listUnder(join(PROJECT_ROOT, "aidd_docs"));
    expect(docsFiles).toHaveLength(0);
  });

  it("does not overwrite a pre-existing user file", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    const docFile = join(PROJECT_ROOT, ".claude", "CLAUDE.md");
    await deps.fs.writeFile(docFile, "custom content");

    await initOf(deps).execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(deps.fs.getFile(docFile)).toBe("custom content");
  });

  describe("initializing only when the manifest is absent", () => {
    it("creates the manifest and answers true when none exists", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });

      const created = await initOf(deps).initializeIfAbsent({
        projectRoot: PROJECT_ROOT,
      });

      expect(created).toBe(true);
      expect(await deps.manifestRepo.load()).not.toBeNull();
    });

    it("leaves an existing manifest alone and answers false", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      const before = deps.manifestRepo.saveCount;

      const created = await initOf(deps).initializeIfAbsent({
        projectRoot: PROJECT_ROOT,
      });

      expect(created).toBe(false);
      expect(deps.manifestRepo.saveCount).toBe(before);
    });
  });

  describe("execute refuses a project that cannot be initialized", () => {
    it("aborts with guidance when .claude/ contains AIDD frontmatter", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await deps.fs.writeFile(
        join(PROJECT_ROOT, ".claude", "commands", "aidd", "02", "brainstorm.md"),
        "---\nname: aidd:02:brainstorm\ndescription: test\n---\nbody"
      );

      await expect(
        initOf(deps).execute({
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(saying("AIDD files detected but no manifest found"));
    });

    it("passes when .claude/ exists without AIDD frontmatter", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await deps.fs.writeFile(
        join(PROJECT_ROOT, ".claude", "commands", "my-command.md"),
        "---\nname: my-command\ndescription: custom\n---\nbody"
      );

      await expect(
        initOf(deps).execute({
          projectRoot: PROJECT_ROOT,
        })
      ).resolves.toHaveProperty("manifest");
    });

    it("aborts when already initialized without --force", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initOf(deps).execute({
        projectRoot: PROJECT_ROOT,
      });
      await expect(
        initOf(deps).execute({
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(saying(/Already initialized/));
    });

    // `aidd init` is not a command this CLI exposes (see the surface in cli.md) - telling
    // a user to run `aidd init --force` points them at something that does not exist.
    it("names a real recovery path, not the nonexistent `aidd init --force`", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initOf(deps).execute({
        projectRoot: PROJECT_ROOT,
      });
      await expect(
        initOf(deps).execute({
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(saying(/aidd clean --force/));
      await expect(
        initOf(deps).execute({
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.not.toThrow(saying(/aidd init --force/));
    });

    it("--force: fails with guidance when no manifest exists", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await expect(
        initOf(deps).execute({
          projectRoot: PROJECT_ROOT,
          force: true,
        })
      ).rejects.toThrow(saying("No AIDD manifest found"));
    });

    it("--force: passes when manifest exists", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initOf(deps).execute({
        projectRoot: PROJECT_ROOT,
      });
      await expect(
        initOf(deps).execute({
          projectRoot: PROJECT_ROOT,
          force: true,
        })
      ).resolves.toHaveProperty("manifest");
    });
  });

  describe("when a forced init finds a manifest", () => {
    it("does not create or alter gitignore while reusing an existing manifest", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      await deps.fs.writeFile(join(PROJECT_ROOT, ".gitignore"), "# User-owned\n");
      const before = (await deps.manifestRepo.load())?.toJSON();
      const result = await initOf(deps).execute({
        projectRoot: PROJECT_ROOT,
        force: true,
      });
      expect(result.manifest.toJSON()).toEqual(before);
      expect(deps.fs.getFile(join(PROJECT_ROOT, ".gitignore"))).toBe("# User-owned\n");
    });

    it("preserves existing manifest tools when --force reinitializes", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.claude);

      const manifestBefore = await deps.manifestRepo.load();
      const toolsBefore = manifestBefore?.getInstalledToolIds() ?? [];

      await initOf(deps).execute({
        projectRoot: PROJECT_ROOT,
        force: true,
      });

      const manifestAfter = await deps.manifestRepo.load();
      const toolsAfter = manifestAfter?.getInstalledToolIds() ?? [];
      expect(toolsAfter).toEqual(toolsBefore);
    });
  });
});
