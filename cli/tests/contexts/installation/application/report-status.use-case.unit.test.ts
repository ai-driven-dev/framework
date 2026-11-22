import { describe, expect, it } from "vitest";
import { InitProject } from "../../../../src/contexts/installation/application/init-project.use-case.js";
import { ReportStatus } from "../../../../src/contexts/installation/application/report-status.use-case.js";
import { DetectPluginDrift } from "../../../../src/contexts/installation/application/shared/detect-plugin-drift.use-case.js";
import {
  ManifestUnavailableError,
  ToolNotInstalledError,
} from "../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../src/shared/domain/installation-file.js";
import { compareSemver } from "../../../../src/shared/domain/plugin/semver.js";
import type { ToolId } from "../../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import { buildInstallationDeps } from "../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../testing/manifest.builder.js";

const PROJECT_ROOT = "/test-project";
const TRACKED = ".claude/rules/one.md";
const CONTENT = "one\n";
const MERGE_PATH = ".vscode/settings.json";
const KEY = "editor.formatOnSave";

function tracking(manifest: Manifest, toolId: ToolId, relativePath: string, content: string) {
  manifest.addTool(toolId, "test", [
    new InstallationFile({ relativePath, content, hash: FileHash.of(content) }),
  ]);
}

function merging(manifest: Manifest) {
  manifest.addTool(TOOL.vscode, "test", []);
  manifest.updateToolMergeFiles(TOOL.vscode, [
    { relativePath: MERGE_PATH, sectionKey: null, entries: { [KEY]: FileHash.of("true") } },
  ]);
}

function statusOver(onDisk: Record<string, string>, manifest: Manifest | null) {
  const files = Object.fromEntries(
    Object.entries(onDisk).map(([relativePath, content]) => [
      `${PROJECT_ROOT}/${relativePath}`,
      content,
    ])
  );
  const fs = new InMemoryFileAdapter(files);
  return new ReportStatus(
    {
      fs,
      manifestRepo: new InMemoryManifestRepository(manifest, PROJECT_ROOT),
      detectPluginDrift: new DetectPluginDrift(fs, registeredTools(), () => "/home/dev"),
    },
    registeredTools()
  );
}

function inSyncTool(toolId: ToolId) {
  return { toolId, version: "test", drifted: [] };
}

describe("reporting a project's status", () => {
  describe("which tools are reported", () => {
    it("fails when no manifest exists", async () => {
      const failure = await statusOver({}, null)
        .execute({ projectRoot: PROJECT_ROOT })
        .catch((e: unknown) => e);

      expect(failure).toBeInstanceOf(ManifestUnavailableError);
      expect(failure).toMatchObject({ code: "manifest-missing" });
    });

    it("reports from the manifest it is handed, reading none of its own", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);

      const report = await statusOver({}, null).execute({
        projectRoot: PROJECT_ROOT,
        manifest,
      });

      expect(report.tools).toStrictEqual([inSyncTool(TOOL.claude)]);
    });

    it("refuses a filter naming a tool that is not installed", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);

      await expect(
        statusOver({}, manifest).execute({
          projectRoot: PROJECT_ROOT,
          filterToolId: TOOL.cursor,
        })
      ).rejects.toThrow(ToolNotInstalledError);
    });

    it("reports only the filtered tool", async () => {
      const manifest = aManifest()
        .withTool(TOOL.claude, [], { version: "test" })
        .withTool(TOOL.vscode, [], { version: "test" })
        .build();

      const report = await statusOver({}, manifest).execute({
        projectRoot: PROJECT_ROOT,
        filterToolId: TOOL.claude,
      });

      expect(report).toStrictEqual({
        tools: [inSyncTool(TOOL.claude)],
        pluginDrift: [],
        inSync: true,
      });
    });

    it("reports only the tools of the requested category", async () => {
      const manifest = aManifest()
        .withTool(TOOL.claude, [], { version: "test" })
        .withTool(TOOL.vscode, [], { version: "test" })
        .build();

      const report = await statusOver({}, manifest).execute({
        projectRoot: PROJECT_ROOT,
        category: "ide",
      });

      expect(report).toStrictEqual({
        tools: [inSyncTool(TOOL.vscode)],
        pluginDrift: [],
        inSync: true,
      });
    });

    it("reports a tool whose directory is absent from disk as in sync", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);

      const report = await statusOver({}, manifest).execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(report).toStrictEqual({
        tools: [inSyncTool(TOOL.claude)],
        pluginDrift: [],
        inSync: true,
      });
    });
  });

  describe("tracked files", () => {
    function manifestTracking() {
      const manifest = Manifest.create();
      tracking(manifest, TOOL.claude, TRACKED, CONTENT);
      return manifest;
    }

    it("reports an untouched tracked file as in sync", async () => {
      const report = await statusOver({ [TRACKED]: CONTENT }, manifestTracking()).execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(report).toStrictEqual({
        tools: [inSyncTool(TOOL.claude)],
        pluginDrift: [],
        inSync: true,
      });
    });

    it("calls a tracked file whose content changed modified", async () => {
      const report = await statusOver({ [TRACKED]: "edited\n" }, manifestTracking()).execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(report).toStrictEqual({
        tools: [
          {
            toolId: TOOL.claude,
            version: "test",
            drifted: [{ relativePath: TRACKED, status: "modified" }],
          },
        ],
        pluginDrift: [],
        inSync: false,
      });
    });

    it("calls a tracked file gone from disk deleted", async () => {
      const report = await statusOver({}, manifestTracking()).execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(report.tools).toStrictEqual([
        {
          toolId: TOOL.claude,
          version: "test",
          drifted: [{ relativePath: TRACKED, status: "deleted" }],
        },
      ]);
    });

    it("calls a file in the tool directory the manifest does not track added", async () => {
      const report = await statusOver(
        { [TRACKED]: CONTENT, ".claude/rules/two.md": "two\n" },
        manifestTracking()
      ).execute({ projectRoot: PROJECT_ROOT });

      expect(report.tools).toStrictEqual([
        {
          toolId: TOOL.claude,
          version: "test",
          drifted: [{ relativePath: ".claude/rules/two.md", status: "added" }],
        },
      ]);
    });

    it("leaves a backup file out of the additions", async () => {
      const report = await statusOver(
        { [TRACKED]: CONTENT, ".claude/rules/one.md.backup": "old\n" },
        manifestTracking()
      ).execute({ projectRoot: PROJECT_ROOT });

      expect(report.tools).toStrictEqual([inSyncTool(TOOL.claude)]);
    });
  });

  describe("merge files", () => {
    const DRIFT_PATH = `${MERGE_PATH} > ${KEY}`;

    function manifestMerging() {
      const manifest = Manifest.create();
      merging(manifest);
      return manifest;
    }

    it("reports a merge file whose managed keys match as in sync", async () => {
      const report = await statusOver(
        { [MERGE_PATH]: `{ "${KEY}": true }` },
        manifestMerging()
      ).execute({ projectRoot: PROJECT_ROOT });

      expect(report).toStrictEqual({
        tools: [inSyncTool(TOOL.vscode)],
        pluginDrift: [],
        inSync: true,
      });
    });

    it("calls every managed key of a missing merge file deleted", async () => {
      const report = await statusOver({}, manifestMerging()).execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(report.tools).toStrictEqual([
        {
          toolId: TOOL.vscode,
          version: "test",
          drifted: [{ relativePath: DRIFT_PATH, status: "deleted" }],
        },
      ]);
    });

    it("calls a managed key missing from the merge file deleted", async () => {
      const report = await statusOver({ [MERGE_PATH]: "{}" }, manifestMerging()).execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(report.tools).toStrictEqual([
        {
          toolId: TOOL.vscode,
          version: "test",
          drifted: [{ relativePath: DRIFT_PATH, status: "deleted" }],
        },
      ]);
    });

    it("calls a managed key whose value changed modified", async () => {
      const report = await statusOver(
        { [MERGE_PATH]: `{ "${KEY}": false }` },
        manifestMerging()
      ).execute({ projectRoot: PROJECT_ROOT });

      expect(report.tools).toStrictEqual([
        {
          toolId: TOOL.vscode,
          version: "test",
          drifted: [{ relativePath: DRIFT_PATH, status: "modified" }],
        },
      ]);
    });
  });
});

describe("reporting the drift of installed tools", () => {
  it("reports no drift when no tools are installed", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await new InitProject(
      { fs: deps.fs, manifestRepo: deps.manifestRepo, updateGitignore: deps.updateGitignore },
      registeredTools()
    ).execute({
      projectRoot: PROJECT_ROOT,
    });

    const useCase = new ReportStatus(
      {
        fs: deps.fs,
        manifestRepo: deps.manifestRepo,
        detectPluginDrift: new DetectPluginDrift(deps.fs, registeredTools(), () => "/home/dev"),
      },
      registeredTools()
    );
    const report = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(report.tools).toHaveLength(0);
    expect(report.inSync).toBe(true);
  });

  it("does not call a machine-local file an addition, whatever the profile declares", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await new InitProject(
      { fs: deps.fs, manifestRepo: deps.manifestRepo, updateGitignore: deps.updateGitignore },
      registeredTools()
    ).execute({
      projectRoot: PROJECT_ROOT,
    });
    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest missing");
    manifest.addTool(TOOL.claude, "test", []);
    await deps.manifestRepo.save(manifest);

    // Written by the CLI on purpose and never tracked. Reading the exclusion off
    // `machineLocalFilesOf` is what keeps it matching the path the profile declares.
    for (const relativePath of registeredTools()
      .aiProfile(TOOL.claude)
      .marketplaceRegistration()
      ?.machineLocalFiles() ?? []) {
      await deps.fs.writeFile(`${PROJECT_ROOT}/${relativePath}`, "{}");
    }
    expect(
      (
        registeredTools().aiProfile(TOOL.claude).marketplaceRegistration()?.machineLocalFiles() ??
        []
      ).length
    ).toBeGreaterThan(0);

    const report = await new ReportStatus(
      {
        fs: deps.fs,
        manifestRepo: deps.manifestRepo,
        detectPluginDrift: new DetectPluginDrift(deps.fs, registeredTools(), () => "/home/dev"),
      },
      registeredTools()
    ).execute({ projectRoot: PROJECT_ROOT });

    const drifted = report.tools.flatMap((tool) => tool.drifted);
    expect(drifted).toEqual([]);
    expect(report.inSync).toBe(true);
  });

  describe("comparing two versions", () => {
    it("orders lower major version as smaller", () => {
      expect(compareSemver("1.0.0", "2.0.0")).toBe(-1);
    });

    it("orders lower minor version as smaller", () => {
      expect(compareSemver("3.1.0", "3.2.0")).toBe(-1);
    });

    it("orders higher patch version as greater", () => {
      expect(compareSemver("3.1.1", "3.1.0")).toBe(1);
    });

    it("treats identical versions as equal", () => {
      expect(compareSemver("3.1.0", "3.1.0")).toBe(0);
    });

    it("handles v-prefix", () => {
      expect(compareSemver("3.0.0", "v3.1.0")).toBe(-1);
    });
  });
});
