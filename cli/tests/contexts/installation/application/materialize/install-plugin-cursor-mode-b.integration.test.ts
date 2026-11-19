import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ModeBFlatMaterializationTranslator } from "../../../../../src/contexts/installation/application/materialize/mode-b-flat-materialization-translator.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { translateDistribution } from "../../../../helpers/ports/fake-build-sources.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

const STUB_HOME = "/tmp/test-home";
const PROJECT_ROOT = "/test-project";

function buildDist(name = "aidd-context"): PluginDistribution {
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: TOOL.claude,
    files: [
      { relativePath: "commands/hello.md", content: "---\nname: aidd:01:hello\n---\n# Hello" },
    ],
    components: {
      commands: [
        { relativePath: "commands/hello.md", content: "---\nname: aidd:01:hello\n---\n# Hello" },
      ],
      agents: [],
      rules: [],
      skills: [],
      hooks: [],
      mcp: [],
    },
  });
}

describe("install cursor plugin via Mode B (integration)", () => {
  it("does not write any file under projectRoot", async () => {
    const fs = new InMemoryFileAdapter();
    const adapter = new ModeBFlatMaterializationTranslator(
      fs,
      () => STUB_HOME,
      translateDistribution
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);

    await adapter.addPlugin(
      buildDist("aidd-context"),
      registeredTools().aiProfile(TOOL.cursor),
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      undefined
    );

    expect(fs.listAll().every((p) => !p.startsWith(PROJECT_ROOT))).toBe(true);
  });

  it("stores base-relative keys in Plugin.files (not absolute paths)", async () => {
    const fs = new InMemoryFileAdapter();
    const adapter = new ModeBFlatMaterializationTranslator(
      fs,
      () => STUB_HOME,
      translateDistribution
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);

    await adapter.addPlugin(
      buildDist("aidd-context"),
      registeredTools().aiProfile(TOOL.cursor),
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      undefined
    );

    const plugins = manifest.getPlugins(TOOL.cursor);
    const installed = plugins.find((p) => p.name === "aidd-context");
    expect(installed).toBeDefined();
    expect(installed?.files.size).toBeGreaterThan(0);
    for (const key of installed?.files.keys() ?? []) {
      expect(key).not.toMatch(/^\/|^~\//);
      expect(key.startsWith("aidd-context/")).toBe(true);
    }
  });

  it("join(resolvedBase, key) matches the written absolute path", async () => {
    const fs = new InMemoryFileAdapter();
    const adapter = new ModeBFlatMaterializationTranslator(
      fs,
      () => STUB_HOME,
      translateDistribution
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);

    await adapter.addPlugin(
      buildDist("aidd-context"),
      registeredTools().aiProfile(TOOL.cursor),
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      undefined
    );

    const plugins = manifest.getPlugins(TOOL.cursor);
    const installed = plugins.find((p) => p.name === "aidd-context");
    const resolvedBase = join(STUB_HOME, ".cursor", "plugins", "local");
    for (const key of installed?.files.keys() ?? []) {
      const expectedAbsPath = join(resolvedBase, key);
      expect(fs.has(expectedAbsPath)).toBe(true);
    }
  });
});
