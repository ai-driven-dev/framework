import { describe, expect, it } from "vitest";
import { CheckPluginDrift } from "../../../../../src/contexts/installation/application/doctor/check-plugin-drift.use-case.js";
import { DetectPluginDrift } from "../../../../../src/contexts/installation/application/shared/detect-plugin-drift.use-case.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import type { FileReader } from "../../../../../src/shared/ports/file-reader.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const TRACKED = "abc123abc123abc123abc123abc123ab";
const OTHER = "def456def456def456def456def456de";

function readerOf(disk: Record<string, string>): FileReader {
  return {
    fileExists: async (p) => Object.keys(disk).some((name) => p.endsWith(name)),
    isExecutable: async () => false,
    isDirectory: async () => false,
    realpath: async (path) => path,
    readFileIfReadable: async () => "",
    realpathIfResolvable: async (path) => path,
    readFileHash: async (p) =>
      new FileHash(Object.entries(disk).find(([name]) => p.endsWith(name))?.[1] ?? TRACKED),
    readFile: async () => "",
    listDirectory: async () => [],
    listFilesRecursive: async () => [],
  };
}

function checkerOver(disk: Record<string, string>) {
  const manifest = aManifest()
    .withTool(TOOL.claude, [])
    .withPlugin(
      TOOL.claude,
      RecordedPlugin.fromJSON({
        name: "aidd-test",
        source: { kind: "local", path: "/p" },
        version: "1.0.0",
        strict: false,
        files: { "a/one.md": TRACKED },
        scope: "project",
      })
    )
    .build();
  return new CheckPluginDrift(
    new InMemoryManifestRepository(manifest),
    new DetectPluginDrift(readerOf(disk), registeredTools(), () => "/home/dev")
  );
}

describe("checking plugin files for drift", () => {
  it("answers no issue when every tracked file matches", async () => {
    const issues = await checkerOver({ "one.md": TRACKED }).execute({
      projectRoot: "/proj",
      allowedIds: null,
    });

    expect(issues).toEqual([]);
  });

  it("names each drifted file with its kind and path", async () => {
    const issues = await checkerOver({ "one.md": OTHER }).execute({
      projectRoot: "/proj",
      allowedIds: null,
    });

    expect(issues).toEqual([
      {
        toolId: TOOL.claude,
        pluginName: "aidd-test",
        issue: "hash-mismatch",
        filePath: expect.stringContaining("one.md"),
      },
    ]);
  });

  it("skips the tools the run does not allow", async () => {
    const issues = await checkerOver({ "one.md": OTHER }).execute({
      projectRoot: "/proj",
      allowedIds: new Set([TOOL.cursor]),
    });

    expect(issues).toEqual([]);
  });

  it("checks only the named plugin", async () => {
    const issues = await checkerOver({ "one.md": OTHER }).execute({
      projectRoot: "/proj",
      allowedIds: null,
      pluginName: "another",
    });

    expect(issues).toEqual([]);
  });
});
