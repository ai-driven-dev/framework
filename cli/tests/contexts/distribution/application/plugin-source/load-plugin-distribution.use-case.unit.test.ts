import { describe, expect, it, vi } from "vitest";
import { LoadPluginDistribution } from "../../../../../src/contexts/distribution/application/plugin-source/load-plugin-distribution.use-case.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const source = { kind: "local" as const, path: "/source" };
const dist = new PluginDistribution({
  manifest: { name: "sample", version: "1.0.0" },
  format: TOOL.claude,
  files: [],
  components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
});

describe("LoadPluginDistribution", () => {
  it("fetches the requested source and reads its fetched path", async () => {
    const fetch = vi.fn().mockResolvedValue("/cache/fetched");
    const read = vi.fn().mockResolvedValue(dist);
    const loader = new LoadPluginDistribution({ fetch }, { read });

    expect(await loader.execute({ source, cacheDir: "/cache", forceRefresh: true })).toBe(dist);
    expect(fetch).toHaveBeenCalledWith(source, "/cache", { forceRefresh: true });
    expect(read).toHaveBeenCalledWith("/cache/fetched");
  });

  it("propagates a fetch failure without reading an unfetched distribution", async () => {
    const read = vi.fn();
    const loader = new LoadPluginDistribution(
      {
        fetch: async () => {
          throw new Error("cannot fetch");
        },
      },
      { read }
    );

    await expect(loader.execute({ source, cacheDir: "/cache" })).rejects.toThrow("cannot fetch");
    expect(read).not.toHaveBeenCalled();
  });
});
