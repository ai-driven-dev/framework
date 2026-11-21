import { describe, expect, it } from "vitest";
import { BuiltTreeMaterializationTranslator } from "../../../../../src/contexts/installation/application/materialize/built-tree-materialization-translator.js";
import { ModeAMarketplaceTranslator } from "../../../../../src/contexts/installation/application/materialize/mode-a-marketplace-translator.js";
import { resolveTranslator } from "../../../../../src/contexts/installation/application/materialize/plugin-translator-factory.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";

function buildDeps(homedir = "/stub-home") {
  const fs = new InMemoryFileAdapter();
  return {
    fs,
    built: { ...fakeBuiltDeps(), homedir: () => homedir },
  };
}

function requirePlugins<T>(plugins: T | null): T {
  if (plugins === null) throw new Error("the tool declares no plugins");
  return plugins;
}

describe("resolveTranslator", () => {
  describe("when the plugins do not materialize from the built tree", () => {
    it("returns ModeAMarketplaceTranslator", () => {
      const deps = buildDeps();
      const plugins = registeredTools().aiProfile(TOOL.claude).plugins();
      const adapter = resolveTranslator(requirePlugins(plugins), deps);
      expect(adapter).toBeInstanceOf(ModeAMarketplaceTranslator);
      expect(adapter?.mode).toBe("marketplace");
    });
  });

  describe("when installScope is user", () => {
    it("returns BuiltTreeMaterializationTranslator", () => {
      const deps = buildDeps();
      const plugins = registeredTools().aiProfile(TOOL.cursor).plugins();
      const adapter = resolveTranslator(requirePlugins(plugins), deps);
      expect(adapter).toBeInstanceOf(BuiltTreeMaterializationTranslator);
      expect(adapter?.mode).toBe("flat");
    });
  });
});
