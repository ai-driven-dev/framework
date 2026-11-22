import { describe, expect, it } from "vitest";
import { ReportStatus } from "../../../../src/contexts/installation/application/report-status.use-case.js";
import { DetectPluginDrift } from "../../../../src/contexts/installation/application/shared/detect-plugin-drift.use-case.js";
import type { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { ManifestRepository } from "../../../../src/contexts/installation/ports/manifest-repository.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../testing/manifest.builder.js";

const EXPECTED_HASH = "abc123abc123abc123abc123abc123ab";
const DRIFTED_HASH = "def456def456def456def456def456de";
const PLUGIN_FILE = ".claude/plugins/test-plugin/commands/greet.md";

function makeManifest(pluginFileHash: string): Manifest {
  const manifest = aManifest()
    .withTool(TOOL.claude, [])
    .withPlugin(
      TOOL.claude,
      RecordedPlugin.fromJSON({
        name: "test-plugin",
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
    readFileIfReadable: async () => undefined,
    realpathIfResolvable: async (path: string) => path,
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

describe("ReportStatus - plugin drift", () => {
  describe("when plugin file has drifted", () => {
    it("returns plugin drift entry for the drifted tool", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const fs = makeFs(true, DRIFTED_HASH);
      const useCase = new ReportStatus(
        {
          fs,
          manifestRepo: makeManifestRepo(manifest),
          detectPluginDrift: new DetectPluginDrift(fs, registeredTools(), () => "/home/dev"),
        },
        registeredTools()
      );

      const report = await useCase.execute({
        projectRoot: "/proj",
      });

      expect(report.pluginDrift).toHaveLength(1);
      expect(report.pluginDrift[0].toolId).toBe("claude");
      expect(report.pluginDrift[0].pluginName).toBe("test-plugin");
      expect(report.pluginDrift[0].driftedFiles).toContain(PLUGIN_FILE);
      expect(report.inSync).toBe(false);
    });
  });

  describe("when plugin file is in sync", () => {
    it("returns empty pluginDrift and inSync true (assuming no other drift)", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const fs = makeFs(true, EXPECTED_HASH);
      const useCase = new ReportStatus(
        {
          fs,
          manifestRepo: makeManifestRepo(manifest),
          detectPluginDrift: new DetectPluginDrift(fs, registeredTools(), () => "/home/dev"),
        },
        registeredTools()
      );

      const report = await useCase.execute({
        projectRoot: "/proj",
      });

      expect(report.pluginDrift).toHaveLength(0);
    });
  });

  describe("when plugin file is missing", () => {
    it("reports the file as drifted", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const fs = makeFs(false, EXPECTED_HASH);
      const useCase = new ReportStatus(
        {
          fs,
          manifestRepo: makeManifestRepo(manifest),
          detectPluginDrift: new DetectPluginDrift(fs, registeredTools(), () => "/home/dev"),
        },
        registeredTools()
      );

      const report = await useCase.execute({
        projectRoot: "/proj",
      });

      expect(report.pluginDrift).toHaveLength(1);
      expect(report.pluginDrift[0].driftedFiles).toContain(PLUGIN_FILE);
    });
  });

  describe("when pluginName filter is set", () => {
    it("only checks the specified plugin", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const fs = makeFs(true, DRIFTED_HASH);
      const useCase = new ReportStatus(
        {
          fs,
          manifestRepo: makeManifestRepo(manifest),
          detectPluginDrift: new DetectPluginDrift(fs, registeredTools(), () => "/home/dev"),
        },
        registeredTools()
      );

      const report = await useCase.execute({
        projectRoot: "/proj",
        pluginName: "other-plugin",
      });

      expect(report.pluginDrift).toHaveLength(0);
    });
  });
});
