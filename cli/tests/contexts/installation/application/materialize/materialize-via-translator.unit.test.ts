import { describe, expect, it } from "vitest";
import { materializeViaTranslator } from "../../../../../src/contexts/installation/application/materialize/materialize-via-translator.js";
import type {
  AddPluginRequest,
  AddPluginResult,
  PluginTranslator,
} from "../../../../../src/contexts/installation/application/materialize/plugin-translator.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const NO_COMPONENTS = { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] };

function rematerialize(result: AddPluginResult) {
  const tool = registeredTools().aiProfile(TOOL.claude);
  const plugin = RecordedPlugin.fromMetadata({
    name: "aidd-dev",
    version: "1.0.0",
    source: { kind: "local", path: "/p" },
    strict: false,
    scope: "project",
  });
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  manifest.addPlugin(TOOL.claude, plugin);
  const requests: AddPluginRequest[] = [];
  const translator: PluginTranslator = {
    mode: "marketplace",
    addPlugin: async (request) => {
      requests.push(request);
      return result;
    },
  };
  const dist = new PluginDistribution({
    manifest: { name: "aidd-dev", version: "1.0.0" },
    format: TOOL.claude,
    files: [],
    components: NO_COMPONENTS,
  });
  const count = materializeViaTranslator(translator, {
    dist,
    tool,
    plugin,
    projectRoot: "/root",
    manifest,
  });
  return { count, requests, manifest };
}

describe("materializeViaTranslator()", () => {
  it("drops the recorded entry before the translator re-adds it", async () => {
    const { count, requests, manifest } = rematerialize({ skipped: [], written: 3 });

    await count;

    expect(manifest.getPlugins(TOOL.claude)).toStrictEqual([]);
    expect(requests.map((request) => request.projectRoot)).toStrictEqual(["/root"]);
  });

  it("returns the number of files the translator wrote", async () => {
    expect(await rematerialize({ skipped: [], written: 3 }).count).toBe(3);
  });

  it("reports zero for a translator that writes no files", async () => {
    expect(await rematerialize({ skipped: [] }).count).toBe(0);
  });
});
