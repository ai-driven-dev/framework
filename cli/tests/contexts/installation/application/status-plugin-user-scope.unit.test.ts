import { join } from "node:path";
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

// Cursor Mode B: file key is base-relative (no absolute prefix, relative to user plugins dir)
const PLUGIN_KEY = "aidd-context/commands/hello.md";

function makeManifest(pluginFileHash: string): Manifest {
  const manifest = aManifest()
    .withTool(TOOL.cursor, [])
    .withPlugin(
      TOOL.cursor,
      RecordedPlugin.fromJSON({
        name: "aidd-context",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: { [PLUGIN_KEY]: pluginFileHash },
        scope: "user",
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

describe("ReportStatus - cursor plugin drift (user-scope)", () => {
  describe("when cursor plugin file has drifted (base-relative key)", () => {
    it("resolves absolute path from homedir via userPluginsBaseDir before checking disk", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const checkedPaths: string[] = [];
      const fs: FileReader = {
        fileExists: async (p: string) => {
          checkedPaths.push(p);
          return true;
        },
        isExecutable: async () => false,
        isDirectory: async () => false,
        realpath: async (path: string) => path,
        readFileIfReadable: async () => undefined,
        realpathIfResolvable: async (path: string) => path,
        readFileHash: async () => new FileHash(DRIFTED_HASH),
        readFile: async () => "",
        listDirectory: async () => [],
        listFilesRecursive: async () => [],
      };

      const useCase = new ReportStatus(
        {
          fs,
          manifestRepo: makeManifestRepo(manifest),
          detectPluginDrift: new DetectPluginDrift(fs, registeredTools(), () => "/home/dev"),
        },
        registeredTools()
      );
      await useCase.execute({ projectRoot: "/proj" });

      expect(checkedPaths.some((p) => p.includes(join(".cursor", "plugins", "local")))).toBe(true);
      expect(checkedPaths.every((p) => !p.includes(join("/proj", PLUGIN_KEY)))).toBe(true);
    });

    it("returns plugin drift entry with the relative key", async () => {
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
      expect(report.pluginDrift[0].toolId).toBe("cursor");
      expect(report.pluginDrift[0].pluginName).toBe("aidd-context");
      expect(report.pluginDrift[0].driftedFiles).toContain(PLUGIN_KEY);
    });
  });

  describe("when cursor was never installed on this machine (every tracked file missing)", () => {
    it("reports one collapsed drift entry instead of one per file", async () => {
      const manifest = aManifest()
        .withTool(TOOL.cursor, [])
        .withPlugin(
          TOOL.cursor,
          RecordedPlugin.fromJSON({
            name: "aidd-context",
            source: { kind: "local", path: "/some/path" },
            version: "1.0.0",
            strict: false,
            files: { "aidd-context/a.md": EXPECTED_HASH, "aidd-context/b.md": EXPECTED_HASH },
            scope: "user",
          })
        )
        .build();
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
      expect(report.pluginDrift[0].notInstalledOnMachine).toBe(true);
      expect(report.pluginDrift[0].driftedFiles).toEqual([]);
    });
  });

  describe("when cursor plugin file is in sync (base-relative key)", () => {
    it("returns empty pluginDrift", async () => {
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
});
