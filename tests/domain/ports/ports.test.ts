import { describe, expect, it } from "vitest";
import { FileHash } from "../../../src/domain/models/file-hash.js";
import { FrameworkDescriptor } from "../../../src/domain/models/framework-descriptor.js";
import type { Manifest } from "../../../src/domain/models/manifest.js";
import { Settings } from "../../../src/domain/models/settings.js";
import type { FileSystem } from "../../../src/domain/ports/file-system.js";
import type { FrameworkLoader } from "../../../src/domain/ports/framework-loader.js";
import type { FrameworkResolver } from "../../../src/domain/ports/framework-resolver.js";
import type { Hasher } from "../../../src/domain/ports/hasher.js";
import type { Logger } from "../../../src/domain/ports/logger.js";
import type { ManifestRepository } from "../../../src/domain/ports/manifest-repository.js";
import type { Prompter } from "../../../src/domain/ports/prompter.js";
import type { SettingsRepository } from "../../../src/domain/ports/settings-repository.js";

describe("Port interface type-level tests", () => {
  it("ManifestRepository interface is implementable", () => {
    const impl: ManifestRepository = {
      load: async () => null,
      save: async (_manifest: Manifest) => {},
      delete: async () => {},
    };
    expect(impl).toBeDefined();
  });

  it("SettingsRepository interface is implementable", () => {
    const impl: SettingsRepository = {
      load: async () => new Settings(),
    };
    expect(impl).toBeDefined();
  });

  it("FileSystem interface is implementable", () => {
    const impl: FileSystem = {
      writeFile: async (_path: string, _content: string) => {},
      deleteFile: async (_path: string) => {},
      createDirectory: async (_path: string) => {},
      deleteEmptyDirectories: async (_path: string) => {},
      readFile: async (_path: string) => "",
      listDirectory: async (_path: string) => [],
      fileExists: async (_path: string) => false,
      readFileHash: async (_path: string) => new FileHash("d41d8cd98f00b204e9800998ecf8427e"),
      mergeJsonFile: async (_path: string, _data: Record<string, unknown>) => {},
    };
    expect(impl).toBeDefined();
  });

  it("FrameworkLoader interface is implementable", () => {
    const impl: FrameworkLoader = {
      loadFromDirectory: async (_path: string) => ({
        descriptor: FrameworkDescriptor.fromJson({
          version: "3.0.0",
          content: {
            agents: { directory: "agents", entryFile: null },
          },
        }),
        contentFiles: new Map(),
      }),
    };
    expect(impl).toBeDefined();
  });

  it("FrameworkResolver interface is implementable", () => {
    const impl: FrameworkResolver = {
      resolve: async (_options) => "/tmp/framework",
      getLatestVersion: async () => "3.0.0",
    };
    expect(impl).toBeDefined();
  });

  it("Hasher interface is implementable", () => {
    const impl: Hasher = {
      hash: (_content: string) => new FileHash("d41d8cd98f00b204e9800998ecf8427e"),
    };
    expect(impl).toBeDefined();
  });

  it("Prompter interface is implementable", () => {
    const impl: Prompter = {
      confirm: async (_message: string) => true,
      select: async (_message: string, _choices) => "option-a",
      checkbox: async (_message: string, _choices) => ["option-a"],
    };
    expect(impl).toBeDefined();
  });

  it("Logger interface is implementable", () => {
    const impl: Logger = {
      debug: (_message: string) => {},
      info: (_message: string) => {},
      warn: (_message: string) => {},
    };
    expect(impl).toBeDefined();
  });
});
