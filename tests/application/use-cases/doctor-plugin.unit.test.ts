import { describe, expect, it } from "vitest";
import "../../../src/domain/tools/ai/claude.js";
import { DoctorUseCase } from "../../../src/application/use-cases/doctor-use-case.js";
import { FileHash } from "../../../src/domain/models/file.js";
import { Manifest } from "../../../src/domain/models/manifest.js";
import { Plugin } from "../../../src/domain/models/plugin.js";
import type { FileSystem } from "../../../src/domain/ports/file-system.js";
import type { Hasher } from "../../../src/domain/ports/hasher.js";
import type { Logger } from "../../../src/domain/ports/logger.js";
import type { ManifestRepository } from "../../../src/domain/ports/manifest-repository.js";

const EXPECTED_HASH = "abc123abc123abc123abc123abc123ab";
const DRIFTED_HASH = "def456def456def456def456def456de";
const PLUGIN_FILE = ".claude/plugins/my-plugin/commands/cmd.md";

function makeManifest(pluginFileHash: string): Manifest {
  const manifest = Manifest.create("aidd_docs");
  manifest.addTool("claude", "1.0.0", []);
  manifest.addPlugin(
    "claude",
    Plugin.fromJSON({
      name: "my-plugin",
      source: { kind: "local", path: "/some/path" },
      version: "1.0.0",
      strict: false,
      files: { [PLUGIN_FILE]: pluginFileHash },
    })
  );
  return manifest;
}

function makeFs(fileExists: boolean, diskHash: string): FileSystem {
  return {
    fileExists: async () => fileExists,
    readFileHash: async () => new FileHash(diskHash),
    readFile: async () => "",
    writeFile: async () => {},
    deleteFile: async () => {},
    listDirectory: async () => [],
    deleteEmptyDirectories: async () => {},
    copyFile: async () => {},
  } as unknown as FileSystem;
}

function makeManifestRepo(manifest: Manifest): ManifestRepository {
  return { load: async () => manifest, save: async () => {}, delete: async () => {} };
}

const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  debug: () => {},
};

const noopHasher: Hasher = {
  hash: () => new FileHash("00000000000000000000000000000000"),
};

describe("DoctorUseCase — plugin integrity", () => {
  describe("when plugin file is missing", () => {
    it("reports a missing plugin issue", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const fs = makeFs(false, EXPECTED_HASH);
      const useCase = new DoctorUseCase(fs, makeManifestRepo(manifest), noopHasher, noopLogger);

      const report = await useCase.execute({ projectRoot: "/proj" });

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
      const useCase = new DoctorUseCase(fs, makeManifestRepo(manifest), noopHasher, noopLogger);

      const report = await useCase.execute({ projectRoot: "/proj" });

      expect(report.pluginIssues).toHaveLength(1);
      expect(report.pluginIssues[0].issue).toBe("hash-mismatch");
      expect(report.pluginIssues[0].toolId).toBe("claude");
    });
  });

  describe("when all plugin files are present and correct", () => {
    it("returns empty pluginIssues", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const fs = makeFs(true, EXPECTED_HASH);
      const useCase = new DoctorUseCase(fs, makeManifestRepo(manifest), noopHasher, noopLogger);

      const report = await useCase.execute({ projectRoot: "/proj" });

      expect(report.pluginIssues).toHaveLength(0);
    });
  });

  describe("when pluginName filter is set", () => {
    it("only checks the specified plugin", async () => {
      const manifest = makeManifest(EXPECTED_HASH);
      const fs = makeFs(false, EXPECTED_HASH);
      const useCase = new DoctorUseCase(fs, makeManifestRepo(manifest), noopHasher, noopLogger);

      const report = await useCase.execute({ projectRoot: "/proj", pluginName: "other-plugin" });

      expect(report.pluginIssues).toHaveLength(0);
    });
  });
});
