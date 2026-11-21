import { describe, expect, it } from "vitest";
import { ListPluginSources } from "../../../../../src/contexts/installation/application/marketplace/list-plugin-sources.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const source = { kind: "local", path: "/p" } as const;

describe("ListPluginSources", () => {
  it("answers nothing when the project has no manifest", async () => {
    const useCase = new ListPluginSources(new InMemoryManifestRepository(), registeredTools());

    await expect(useCase.execute()).resolves.toEqual([]);
  });

  it("lists only the plugins that name a marketplace", async () => {
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(
        TOOL.claude,
        InstalledPlugin.fromMetadata({
          name: "a",
          version: "1.0.0",
          source,
          strict: false,
          scope: "project",
          marketplace: "mkt",
        })
      )
      .withPlugin(
        TOOL.claude,
        InstalledPlugin.fromMetadata({
          name: "b",
          version: "1.0.0",
          source,
          strict: false,
          scope: "project",
        })
      )
      .build();
    const useCase = new ListPluginSources(
      new InMemoryManifestRepository(manifest),
      registeredTools()
    );

    await expect(useCase.execute()).resolves.toEqual([
      { toolId: TOOL.claude, plugin: "a", marketplace: "mkt" },
    ]);
  });
});
