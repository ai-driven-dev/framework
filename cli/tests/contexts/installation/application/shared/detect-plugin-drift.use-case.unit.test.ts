import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DetectPluginDrift } from "../../../../../src/contexts/installation/application/shared/detect-plugin-drift.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import type { FileReader } from "../../../../../src/shared/ports/file-reader.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const HASH_A = "abc123abc123abc123abc123abc123ab";
const HASH_B = "def456def456def456def456def456de";

function cursorManifestWithFiles(files: Record<string, string>): Manifest {
  const manifest = aManifest()
    .withTool(TOOL.cursor, [])
    .withPlugin(
      TOOL.cursor,
      InstalledPlugin.fromJSON({
        name: "aidd-test",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files,
        scope: "user",
      })
    )
    .build();
  return manifest;
}

function makeFs(missing: Set<string>): FileReader {
  return {
    fileExists: async (p: string) => ![...missing].some((m) => p.endsWith(m)),
    isExecutable: async () => false,
    isDirectory: async () => false,
    realpath: async (path: string) => path,
    // Present files always match their own manifest hash: this fixture is about which
    // files are missing, not about hash mismatches, which the other unit tests cover.
    readFileHash: async (p: string) => new FileHash(p.endsWith("two.md") ? HASH_B : HASH_A),
    readFile: async () => "",
    listDirectory: async () => [],
    listFilesRecursive: async () => [],
  };
}

describe("DetectPluginDrift - user-scope tool never installed on this machine", () => {
  it("collapses a plugin whose every tracked file is missing into one not-installed entry", async () => {
    const files = { "a/one.md": HASH_A, "a/two.md": HASH_B };
    const manifest = cursorManifestWithFiles(files);
    const fs = makeFs(new Set(["one.md", "two.md"]));
    const useCase = new DetectPluginDrift(fs, registeredTools());

    const drifts = await useCase.execute({
      manifest,
      projectRoot: "/proj",
      toolIds: [TOOL.cursor],
    });

    expect(drifts).toHaveLength(1);
    expect(drifts[0].notInstalledOnMachine).toBe(true);
    expect(drifts[0].files).toHaveLength(0);
  });

  it("still reports per-file drift when only one of several tracked files is missing", async () => {
    const files = { "a/one.md": HASH_A, "a/two.md": HASH_B };
    const manifest = cursorManifestWithFiles(files);
    const fs = makeFs(new Set(["one.md"]));
    const useCase = new DetectPluginDrift(fs, registeredTools());

    const drifts = await useCase.execute({
      manifest,
      projectRoot: "/proj",
      toolIds: [TOOL.cursor],
    });

    expect(drifts).toHaveLength(1);
    expect(drifts[0].notInstalledOnMachine).toBe(false);
    expect(drifts[0].files).toHaveLength(1);
    expect(drifts[0].files[0]).toEqual({ relativePath: "a/one.md", kind: "missing" });
  });

  it("does not collapse an all-missing plugin for a project-scope tool", async () => {
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(
        TOOL.claude,
        InstalledPlugin.fromJSON({
          name: "aidd-test",
          source: { kind: "local", path: "/some/path" },
          version: "1.0.0",
          strict: false,
          files: { "a/one.md": HASH_A, "a/two.md": HASH_B },
          scope: "project",
        })
      )
      .build();
    const fs = makeFs(new Set(["one.md", "two.md"]));
    const useCase = new DetectPluginDrift(fs, registeredTools());

    const drifts = await useCase.execute({
      manifest,
      projectRoot: "/proj",
      toolIds: [TOOL.claude],
    });

    expect(drifts).toHaveLength(1);
    expect(drifts[0].notInstalledOnMachine).toBe(false);
    expect(drifts[0].files).toHaveLength(2);
  });
});

describe("DetectPluginDrift - the manifest's recorded scope wins over the profile", () => {
  it("checks a cursor plugin under projectRoot, not ~/.cursor/plugins/local, when scope: project disagrees with cursor's profile", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "1.0.0", []);
    manifest.addPlugin(
      TOOL.cursor,
      InstalledPlugin.fromJSON({
        name: "aidd-test",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: { "a/one.md": HASH_A },
        // Disagrees with cursor's own profile, which declares installScope "user".
        scope: "project",
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
      readFileHash: async () => new FileHash(HASH_A),
      readFile: async () => "",
      listDirectory: async () => [],
      listFilesRecursive: async () => [],
    };
    const useCase = new DetectPluginDrift(fs, registeredTools());

    const drifts = await useCase.execute({
      manifest,
      projectRoot: "/proj",
      toolIds: [TOOL.cursor],
    });

    expect(drifts).toHaveLength(0);
    expect(checkedPaths).toContain(join("/proj", "a", "one.md"));
    expect(checkedPaths.some((p) => p.includes(".cursor"))).toBe(false);
  });

  // The `notInstalledOnMachine` collapse exists for a user-scope directory a fresh machine
  // has not populated; what it measures is the manifest's recorded scope, not the profile's.
  it("reports real per-file drift, not a collapsed not-installed entry, for a cursor plugin recorded scope: project", async () => {
    const manifest = aManifest()
      .withTool(TOOL.cursor, [])
      .withPlugin(
        TOOL.cursor,
        InstalledPlugin.fromJSON({
          name: "aidd-test",
          source: { kind: "local", path: "/some/path" },
          version: "1.0.0",
          strict: false,
          files: { "a/one.md": HASH_A, "a/two.md": HASH_B },
          scope: "project",
        })
      )
      .build();
    const fs = makeFs(new Set(["one.md", "two.md"]));
    const useCase = new DetectPluginDrift(fs, registeredTools());

    const drifts = await useCase.execute({
      manifest,
      projectRoot: "/proj",
      toolIds: [TOOL.cursor],
    });

    expect(drifts).toHaveLength(1);
    expect(drifts[0].notInstalledOnMachine).toBe(false);
    expect(drifts[0].files).toHaveLength(2);
  });
});
