import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import {
  extractAtReferences,
  extractMarkdownLinkTargets,
} from "../../../src/contexts/installation/domain/markdown-references.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
  installTool,
} from "../../shared/testing/installation-deps.builder.js";
import { saying } from "../../shared/testing/saying.builder.js";
import {
  SYNTHETIC_NATIVE_TOOL,
  SYNTHETIC_UPDATING_NATIVE_TOOL,
  syntheticNativeFamilyCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import { SYNTHETIC_IDE_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";
import { buildRunDoctor } from "../testing/build-run-doctor.builder.js";

function withCodexActivator() {
  return {
    tools: syntheticNativeFamilyCatalog(),
    nativePluginActivators: new Map([[SYNTHETIC_UPDATING_NATIVE_TOOL, new FakeHostActions()]]),
  };
}

const PROJECT_ROOT = "/test-project";

describe("extracting @path references", () => {
  it("extracts @path references with at least one slash", () => {
    expect(extractAtReferences("See @.claude/agents/iris.md for details")).toEqual([
      ".claude/agents/iris.md",
    ]);
  });

  it("deduplicates identical references", () => {
    const refs = extractAtReferences("@foo/bar.md and @foo/bar.md again");
    expect(refs).toHaveLength(1);
  });

  it("ignores @word with no slash (single-segment)", () => {
    expect(extractAtReferences("@username has no slash")).toEqual([]);
  });

  it("extracts @path references inside plain fenced code blocks (no language)", () => {
    expect(extractAtReferences("```\n@.claude/agents/missing.md\n```")).toEqual([
      ".claude/agents/missing.md",
    ]);
  });

  it("extracts @path references inside ```markdown fenced code blocks", () => {
    expect(extractAtReferences("```markdown\n@aidd_docs/templates/aidd/agent.md\n```")).toEqual([
      "aidd_docs/templates/aidd/agent.md",
    ]);
  });

  it("skips @path references inside non-markdown fenced code blocks (e.g. ```text)", () => {
    expect(extractAtReferences("```text\n@path/to/file.md\n```")).toEqual([]);
  });

  it("skips references inside inline code", () => {
    expect(extractAtReferences("`@.claude/rules/test.md`")).toEqual([]);
  });
});

describe("extracting markdown link targets", () => {
  it("extracts relative markdown link targets", () => {
    expect(extractMarkdownLinkTargets("[doc](aidd_docs/memory/architecture.md)")).toEqual([
      "aidd_docs/memory/architecture.md",
    ]);
  });

  it("ignores http/https links", () => {
    expect(extractMarkdownLinkTargets("[site](https://example.com)")).toEqual([]);
  });

  it("deduplicates identical targets", () => {
    const refs = extractMarkdownLinkTargets("[a](foo/bar.md) [b](foo/bar.md)");
    expect(refs).toHaveLength(1);
  });

  it("extracts targets inside plain fenced code blocks (no language)", () => {
    expect(extractMarkdownLinkTargets("```\n[doc](foo/bar.md)\n```")).toEqual(["foo/bar.md"]);
  });

  it("extracts targets inside ```markdown fenced code blocks", () => {
    expect(extractMarkdownLinkTargets("```markdown\n[doc](aidd_docs/memory/arch.md)\n```")).toEqual(
      ["aidd_docs/memory/arch.md"]
    );
  });

  it("skips targets inside non-markdown fenced code blocks (e.g. ```text)", () => {
    expect(extractMarkdownLinkTargets("```text\n[doc](foo/bar.md)\n```")).toEqual([]);
  });
});

describe("running the doctor on installation health", () => {
  it("reports healthy when all files are in sync", async () => {
    const deps = await buildInstallationDeps(withCodexActivator());
    await initAndInstall(deps, PROJECT_ROOT, SYNTHETIC_NATIVE_TOOL);

    const useCase = buildRunDoctor(deps);
    const report = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(report.healthy).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("fails when manifest is corrupted", async () => {
    const deps = await buildInstallationDeps(withCodexActivator());
    await initAndInstall(deps, PROJECT_ROOT, SYNTHETIC_NATIVE_TOOL);

    // The doctor reads through `manifestRepo.load()`, so a corrupt manifest is a load that
    // throws - the in-memory double never does on its own.
    const corruptRepo = Object.create(deps.manifestRepo) as typeof deps.manifestRepo;
    corruptRepo.load = async () => {
      throw new Error("Manifest is corrupted");
    };
    const useCase = buildRunDoctor({ ...deps, manifestRepo: corruptRepo });
    await expect(useCase.execute({ projectRoot: PROJECT_ROOT })).rejects.toThrow(
      saying("Manifest is corrupted")
    );
  });

  it("fails if project is not initialized", async () => {
    const deps = await buildInstallationDeps(withCodexActivator());

    const useCase = buildRunDoctor(deps);
    await expect(useCase.execute({ projectRoot: PROJECT_ROOT })).rejects.toThrow(
      saying("aidd setup")
    );
  });

  it("does not report broken reference for directory-only @path (trailing slash, no extension)", async () => {
    const deps = await buildInstallationDeps(withCodexActivator());
    await initAndInstall(deps, PROJECT_ROOT, SYNTHETIC_NATIVE_TOOL);

    const firstFile = { relativePath: ".claude/plugins/aidd-test/agents/code-reviewer.md" };
    await deps.fs.writeFile(
      join(PROJECT_ROOT, firstFile.relativePath),
      "See @.claude/agents/ for all agents"
    );

    const useCase = buildRunDoctor(deps);
    const report = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    const brokenRefIssues = report.issues.filter((i) => i.message.startsWith("Broken reference"));
    expect(brokenRefIssues.every((i) => !i.message.includes(".claude/agents/"))).toBe(true);
  });

  it("does not report broken @path reference inside non-markdown fenced code block", async () => {
    const deps = await buildInstallationDeps(withCodexActivator());
    await initAndInstall(deps, PROJECT_ROOT, SYNTHETIC_NATIVE_TOOL);

    const firstFile = { relativePath: ".claude/plugins/aidd-test/agents/code-reviewer.md" };
    await deps.fs.writeFile(
      join(PROJECT_ROOT, firstFile.relativePath),
      "```text\n@path/to/example.md\n```"
    );

    const useCase = buildRunDoctor(deps);
    const report = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(report.issues.every((i) => !i.message.includes("example.md"))).toBe(true);
  });

  describe("orphan and missing file checks", () => {
    it("does not warn about other directories of a tool that is not installed", async () => {
      const deps = await buildInstallationDeps(withCodexActivator());
      await initAndInstall(deps, PROJECT_ROOT, SYNTHETIC_NATIVE_TOOL);

      await deps.fs.writeFile(
        join(PROJECT_ROOT, ".syntheticuser", "workflows", "ci.yml"),
        "name: CI\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n"
      );

      const useCase = buildRunDoctor(deps);
      const report = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      const githubOrphanIssue = report.issues.find(
        (i) => i.message.includes(".syntheticuser/") && i.message.includes("Orphaned")
      );
      expect(githubOrphanIssue).toBeUndefined();
    });

    it("warns when a user-scope tool's files are present on disk but not tracked in the manifest", async () => {
      const deps = await buildInstallationDeps(withCodexActivator());
      await initAndInstall(deps, PROJECT_ROOT, SYNTHETIC_NATIVE_TOOL);

      // An aidd-named prompt file the manifest does not track.
      await deps.fs.writeFile(
        join(PROJECT_ROOT, ".syntheticuser", "commands", "plan.md"),
        "---\nname: aidd:01:plan\ndescription: Plan feature\n---\nContent here.\n"
      );

      const useCase = buildRunDoctor(deps);
      const report = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      const orphanIssues = report.issues.filter(
        (i) => i.message.includes(".syntheticuser/") && i.message.includes("Orphaned")
      );
      expect(orphanIssues).toHaveLength(1);
      expect(orphanIssues[0].severity).toBe("warning");
    });

    it("does not warn about non-aidd files found in a user-scope tool's directories", async () => {
      const deps = await buildInstallationDeps(withCodexActivator());
      await initAndInstall(deps, PROJECT_ROOT, SYNTHETIC_NATIVE_TOOL);

      await deps.fs.writeFile(
        join(PROJECT_ROOT, ".syntheticuser", "commands", "custom.md"),
        "---\nname: my-custom-prompt\ndescription: A custom prompt\n---\nContent here.\n"
      );

      const useCase = buildRunDoctor(deps);
      const report = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      const githubOrphanIssue = report.issues.find(
        (i) => i.message.includes(".syntheticuser/") && i.message.includes("Orphaned")
      );
      expect(githubOrphanIssue).toBeUndefined();
    });
  });

  describe("tool health", () => {
    async function installedBothCategories() {
      const deps = await buildInstallationDeps(withCodexActivator());
      await initAndInstall(deps, PROJECT_ROOT, SYNTHETIC_NATIVE_TOOL);
      await installTool(deps, PROJECT_ROOT, SYNTHETIC_IDE_TOOL);
      const manifest = await deps.manifestRepo.load();
      if (manifest === null) throw new Error("manifest missing");
      return { deps, manifest };
    }

    function healthOf(manifest: Manifest, toolId: ToolId) {
      return {
        toolId,
        fileCount: manifest.getToolFiles(toolId).length,
        mergeFileCount: manifest.getMergeFiles(toolId).length,
      };
    }

    it("reports one entry per installed tool with its file and merge-file counts", async () => {
      const { deps, manifest } = await installedBothCategories();

      const report = await buildRunDoctor(deps).execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(report.toolHealth).toStrictEqual([
        healthOf(manifest, SYNTHETIC_NATIVE_TOOL),
        healthOf(manifest, SYNTHETIC_IDE_TOOL),
      ]);
    });

    it("narrows the entries to the requested category", async () => {
      const { deps, manifest } = await installedBothCategories();

      const report = await buildRunDoctor(deps).execute({
        projectRoot: PROJECT_ROOT,
        category: "ide",
      });

      expect(report.toolHealth).toStrictEqual([healthOf(manifest, SYNTHETIC_IDE_TOOL)]);
    });
  });

  describe("narrowed to a category", () => {
    it("does not look for orphaned directories", async () => {
      const deps = await buildInstallationDeps(withCodexActivator());
      await initAndInstall(deps, PROJECT_ROOT, SYNTHETIC_NATIVE_TOOL);
      await deps.fs.writeFile(
        join(PROJECT_ROOT, ".syntheticuser", "commands", "plan.md"),
        "---\nname: aidd:03:plan\ndescription: Plan feature\n---\nContent here.\n"
      );

      const report = await buildRunDoctor(deps).execute({
        projectRoot: PROJECT_ROOT,
        category: "ai",
      });

      expect(report.issues).toStrictEqual([]);
    });
  });
});
