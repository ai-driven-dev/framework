import { describe, expect, it } from "vitest";
import type { PluginAddOptions } from "../../../../../../src/contexts/installation/application/plugin/add/plugin-add.js";
import { registerNativeGithubPlugins } from "../../../../../../src/contexts/installation/application/plugin/add/register-native-github-plugins.js";
import type { GithubAddedPluginSource } from "../../../../../../src/contexts/installation/application/plugin/add/resolve-added-plugin-source.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const OPTIONS: PluginAddOptions = {
  source: { kind: "local", path: "/plugin" },
  toolIds: "all",
  projectRoot: "/test-project",
  interactive: false,
  githubMarketplace: true,
  marketplace: "market",
  pluginMetadata: { name: "sample", strict: true },
};

function added(overrides: Partial<GithubAddedPluginSource>): GithubAddedPluginSource {
  return {
    isGithubMarketplace: true,
    distribution: undefined,
    version: "2.0.0",
    flat: [],
    native: [TOOL.claude],
    ...overrides,
  };
}

function manifest(): Manifest {
  const created = Manifest.create();
  created.addTool(TOOL.claude, "1.0.0", []);
  return created;
}

describe("registerNativeGithubPlugins", () => {
  it("records the plugin for each natively installed tool at the catalog version", () => {
    const target = manifest();

    registerNativeGithubPlugins(registeredTools(), {
      options: OPTIONS,
      added: added({}),
      manifest: target,
    });

    const [recorded] = target.getPlugins(TOOL.claude);
    expect([recorded?.name, recorded?.version, recorded?.marketplace]).toStrictEqual([
      "sample",
      "2.0.0",
      "market",
    ]);
  });

  it("records nothing without a native tool or a known version", () => {
    const target = manifest();

    registerNativeGithubPlugins(registeredTools(), {
      options: OPTIONS,
      added: added({ native: [] }),
      manifest: target,
    });
    registerNativeGithubPlugins(registeredTools(), {
      options: OPTIONS,
      added: added({ version: undefined }),
      manifest: target,
    });

    expect(target.getPlugins(TOOL.claude)).toStrictEqual([]);
  });
});
