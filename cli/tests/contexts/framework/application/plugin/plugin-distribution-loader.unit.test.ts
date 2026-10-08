import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PluginDistributionLoader } from "../../../../../src/contexts/framework/application/plugin/plugin-distribution-loader.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { PLUGIN_CACHE_SUBDIR } from "../../../../../src/kernel/paths.js";

const source = { kind: "local" as const, path: "/source" };
const dist = new PluginDistribution({
  manifest: { name: "sample", version: "1.0.0" },
  format: "claude",
  files: [],
  components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
});

describe("PluginDistributionLoader", () => {
  it("fetches the requested source and reads its fetched path", async () => {
    const fetch = vi.fn().mockResolvedValue("/cache/fetched");
    const read = vi.fn().mockResolvedValue(dist);
    const loader = new PluginDistributionLoader({ fetch }, { read });

    expect(await loader.load(source, "/cache", { forceRefresh: true })).toBe(dist);
    expect(fetch).toHaveBeenCalledWith(source, "/cache", { forceRefresh: true });
    expect(read).toHaveBeenCalledWith("/cache/fetched");
  });

  it("propagates a fetch failure without reading an unfetched distribution", async () => {
    const read = vi.fn();
    const loader = new PluginDistributionLoader(
      {
        fetch: async () => {
          throw new Error("cannot fetch");
        },
      },
      { read }
    );

    await expect(loader.load(source, "/cache")).rejects.toThrow("cannot fetch");
    expect(read).not.toHaveBeenCalled();
  });

  it("refreshes an installed plugin in the existing project cache", async () => {
    const fetch = vi.fn().mockResolvedValue("/cache/fetched");
    const loader = new PluginDistributionLoader({ fetch }, { read: async () => dist });
    const plugin = InstalledPlugin.fromMetadata("sample", "0.0.1", source, false, "user");

    expect(await loader.loadLatest(plugin, "/project")).toBe(dist);
    expect(fetch).toHaveBeenCalledWith(source, join("/project", PLUGIN_CACHE_SUBDIR), {
      forceRefresh: true,
    });
  });
});
