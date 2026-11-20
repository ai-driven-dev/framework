import { describe, expect, it, vi } from "vitest";
import { ResolveAddedPluginSource } from "../../../../../../src/contexts/installation/application/plugin/add/resolve-added-plugin-source.js";
import { PluginDistributionLoader } from "../../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { PluginDistribution } from "../../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps } from "../../../testing/fake-build-sources.js";
import { buildInstallationDeps } from "../../../testing/installation-deps.js";

const PROJECT_ROOT = "/test-project";
const SOURCE = { kind: "local" as const, path: "/plugin" };
const INPUT = { source: SOURCE, projectRoot: PROJECT_ROOT, toolIds: [TOOL.claude] };

const fetch = vi.fn(async () => "/fetched");

async function resolver() {
  const deps = await buildInstallationDeps();
  fetch.mockClear();
  const reader = {
    read: async () =>
      new PluginDistribution({
        manifest: { name: "sample-plugin", version: "1.0.0" },
        format: TOOL.claude,
        files: [],
        components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
      }),
  };
  return new ResolveAddedPluginSource(
    new PluginDistributionLoader({ fetch }, reader),
    deps.fs,
    fakeBuiltDeps(),
    registeredTools()
  );
}

describe("ResolveAddedPluginSource", () => {
  it("reads the distribution of a plugin that is not from a github marketplace", async () => {
    const added = await (await resolver()).execute({ ...INPUT, githubMarketplace: false });

    expect(added.isGithubMarketplace).toBe(false);
    expect(added.distribution?.manifest.name).toBe("sample-plugin");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reads nothing for a github marketplace plugin only native tools take, given its version", async () => {
    const added = await (await resolver()).execute({
      ...INPUT,
      githubMarketplace: true,
      catalog: { version: "9.9.9" },
    });

    expect(added).toEqual({
      isGithubMarketplace: true,
      flat: [],
      native: [TOOL.claude],
      distribution: undefined,
      version: "9.9.9",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reads the distribution of a github marketplace plugin that a flat tool takes", async () => {
    const added = await (await resolver()).execute({
      ...INPUT,
      toolIds: [TOOL.cursor],
      githubMarketplace: true,
      catalog: { version: "9.9.9" },
    });

    expect(added.distribution?.manifest.name).toBe("sample-plugin");
    expect(added).toMatchObject({ flat: [TOOL.cursor], version: "9.9.9" });
  });

  it("takes the version from plugin.json when the catalog gives none", async () => {
    const added = await (await resolver()).execute({
      ...INPUT,
      githubMarketplace: true,
      catalog: {},
    });

    expect(added).toMatchObject({ version: "1.0.0" });
  });
});
