import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CheckFileReferences } from "../../../src/contexts/installation/application/doctor/check-file-references.js";
import { CheckMergeFiles } from "../../../src/contexts/installation/application/doctor/check-merge-files.js";
import { CheckPluginDrift } from "../../../src/contexts/installation/application/doctor/check-plugin-drift.js";
import { CheckProjectLayout } from "../../../src/contexts/installation/application/doctor/check-project-layout.js";
import { CheckTrackedFiles } from "../../../src/contexts/installation/application/doctor/check-tracked-files.js";
import { LoadManifest } from "../../../src/contexts/installation/application/doctor/load-manifest.js";
import { LoadManifestForDoctor } from "../../../src/contexts/installation/application/doctor/load-manifest-for-doctor.js";
import { DetectPluginDrift } from "../../../src/contexts/installation/application/shared/detect-plugin-drift.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import { RunDoctor } from "../../../src/orchestration/doctor/run-doctor.js";
import { FileHash } from "../../../src/shared/domain/file.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.builder.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { registeredHostInspector } from "../../shared/testing/registered-host-inspector.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { checkRegistrationOver } from "../testing/build-check-registration.builder.js";

const EXPECTED_HASH = "abc123abc123abc123abc123abc123ab";
const DRIFTED_HASH = "def456def456def456def456def456de";
const PLUGIN_FILE = ".claude/plugins/my-plugin/commands/cmd.md";

function makeManifest(pluginFileHash: string): Manifest {
  const manifest = aManifest()
    .withTool(TOOL.claude, [])
    .withPlugin(
      TOOL.claude,
      InstalledPlugin.fromJSON({
        name: "my-plugin",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: { [PLUGIN_FILE]: pluginFileHash },
        scope: "project",
      })
    )
    .build();
  return manifest;
}

function makeFs(fileExists: boolean, diskHash: string): FileReader {
  return {
    fileExists: async () => fileExists,
    isExecutable: async () => false,
    isDirectory: async () => false,
    realpath: async (path: string) => path,
    readFileHash: async () => new FileHash(diskHash),
    readFile: async () => "",
    listDirectory: async () => [],
    listFilesRecursive: async () => [],
  };
}

function makeManifestRepo(manifest: Manifest): ManifestRepository {
  return {
    path: "/proj/.aidd/manifest.json",
    load: async () => manifest,
    save: async () => {},
    delete: async () => {},
  };
}

function pluginCheck(fs: FileReader, manifest: Manifest): CheckPluginDrift {
  return new CheckPluginDrift(
    new LoadManifest(makeManifestRepo(manifest)),
    new DetectPluginDrift(fs, catalogOf())
  );
}

function makeDoctorUseCase(fs: FileReader, manifest: Manifest): RunDoctor {
  const loadManifest = new LoadManifest(makeManifestRepo(manifest));
  return new RunDoctor(
    new LoadManifestForDoctor(loadManifest),
    {
      tracked: new CheckTrackedFiles(loadManifest, fs),
      merge: new CheckMergeFiles(loadManifest, fs),
      references: new CheckFileReferences(loadManifest, fs),
      layout: new CheckProjectLayout(loadManifest, fs, catalogOf()),
      plugin: new CheckPluginDrift(loadManifest, new DetectPluginDrift(fs, catalogOf())),
    },
    checkRegistrationOver(
      loadManifest,
      fs,
      new InMemoryMarketplaceRegistry(),
      () => false,
      registeredHostInspector(fs, new Map(), new Map()),
      () => "/user-cache",
      { get: () => "1.0.0" },
      catalogOf()
    ),
    { execute: async () => [] },
    catalogOf()
  );
}

describe("DoctorUseCase — plugin integrity", () => {
  describe("when plugin file is missing", () => {
    it("reports a missing plugin issue", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const fs = makeFs(false, EXPECTED_HASH);
      const useCase = makeDoctorUseCase(fs, manifest);

      const report = await useCase.execute({
        projectRoot: "/proj",
      });

      expect(report.pluginIssues).toHaveLength(1);
      expect(report.pluginIssues[0].issue).toBe("missing");
      expect(report.pluginIssues[0].pluginName).toBe("my-plugin");
      expect(report.pluginIssues[0].filePath).toBe(PLUGIN_FILE);
      expect(report.healthy).toBe(false);
    });
  });

  describe("when plugin file has hash mismatch", () => {
    it("reports a hash-mismatch plugin issue", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const fs = makeFs(true, DRIFTED_HASH);
      const useCase = makeDoctorUseCase(fs, manifest);

      const report = await useCase.execute({
        projectRoot: "/proj",
      });

      expect(report.pluginIssues).toHaveLength(1);
      expect(report.pluginIssues[0].issue).toBe("hash-mismatch");
      expect(report.pluginIssues[0].toolId).toBe("claude");
    });
  });

  describe("when all plugin files are present and correct", () => {
    it("returns empty pluginIssues", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const fs = makeFs(true, EXPECTED_HASH);
      const useCase = makeDoctorUseCase(fs, manifest);

      const report = await useCase.execute({
        projectRoot: "/proj",
      });

      expect(report.pluginIssues).toHaveLength(0);
    });
  });

  describe("when pluginName filter is set", () => {
    it("only checks the specified plugin", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const fs = makeFs(false, EXPECTED_HASH);
      const useCase = makeDoctorUseCase(fs, manifest);

      const report = await useCase.execute({
        projectRoot: "/proj",
        pluginName: "other-plugin",
      });

      expect(report.pluginIssues).toHaveLength(0);
    });
  });

  describe("when narrowed to a set of tools", () => {
    it("ignores the plugins of a tool outside the set", async () => {
      const fs = makeFs(false, EXPECTED_HASH);
      const useCase = pluginCheck(fs, makeManifest(EXPECTED_HASH));

      const issues = await useCase.execute({
        projectRoot: "/proj",
        allowedIds: new Set(["cursor"]),
      });

      expect(issues).toStrictEqual([]);
    });

    it("still checks the plugins of a tool inside the set", async () => {
      const fs = makeFs(false, EXPECTED_HASH);
      const useCase = pluginCheck(fs, makeManifest(EXPECTED_HASH));

      const issues = await useCase.execute({
        projectRoot: "/proj",
        allowedIds: new Set(["claude"]),
      });

      expect(issues).toStrictEqual([
        { toolId: TOOL.claude, pluginName: "my-plugin", issue: "missing", filePath: PLUGIN_FILE },
      ]);
    });
  });

  describe("when a user-scope plugin was never installed on this machine", () => {
    it("reports one not-installed-on-machine issue, not one 'missing' issue per file", async () => {
      const manifest = aManifest()
        .withTool(TOOL.cursor, [])
        .withPlugin(
          TOOL.cursor,
          InstalledPlugin.fromJSON({
            name: "aidd-test",
            source: { kind: "local", path: "/some/path" },
            version: "1.0.0",
            strict: false,
            files: { "a/one.md": EXPECTED_HASH, "a/two.md": EXPECTED_HASH },
            scope: "user",
          })
        )
        .build();
      const fs = makeFs(false, EXPECTED_HASH);
      const useCase = pluginCheck(fs, manifest);

      const issues = await useCase.execute({
        projectRoot: "/proj",
        allowedIds: null,
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].issue).toBe("not-installed-on-machine");
      expect(issues[0].toolId).toBe("cursor");
      expect(issues.filter((i) => i.issue === "missing")).toHaveLength(0);
    });
  });

  describe("when plugin is installed under user-scope (Cursor Mode B)", () => {
    it("checks files under the resolved user-scope base dir, not projectRoot", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      const cursorBaseDir = join(homedir(), ".cursor", "plugins", "local");
      const userScopeRelPath = "aidd-context/skills/06-discovery/SKILL.md";
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.fromJSON({
          name: "aidd-context",
          source: { kind: "local", path: "/some/path" },
          version: "1.0.0",
          strict: false,
          files: { [userScopeRelPath]: EXPECTED_HASH },
          scope: "user",
        })
      );
      const checkedPaths: string[] = [];
      const fs: FileReader = {
        fileExists: async (p: string) => {
          checkedPaths.push(p);
          return true;
        },
        isExecutable: async () => false,
        isDirectory: async () => false,
        realpath: async (path: string) => path,
        readFileHash: async () => new FileHash(EXPECTED_HASH),
        readFile: async () => "",
        listDirectory: async () => [],
        listFilesRecursive: async () => [],
      };
      const pluginUseCase = pluginCheck(fs, manifest);

      await pluginUseCase.execute({
        projectRoot: "/proj",
        allowedIds: null,
      });

      const expectedAbs = join(cursorBaseDir, userScopeRelPath);
      expect(checkedPaths).toContain(expectedAbs);
      expect(checkedPaths.every((p) => !p.startsWith("/proj/aidd-context"))).toBe(true);
    });
  });
});
