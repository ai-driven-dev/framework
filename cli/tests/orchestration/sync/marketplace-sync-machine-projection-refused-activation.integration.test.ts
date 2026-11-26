import { describe, expect, it } from "vitest";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import {
  SYNTHETIC_TOOL,
  syntheticNativeCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  manifestWithTool,
  singleListedCatalog,
  unreadableHostPlugins,
} from "../testing/machine-projection.builder.js";

const tool = SYNTHETIC_TOOL;

describe("a Codex plugin the host did not activate is never claimed", () => {
  it.each([
    { name: "binary unavailable", available: false, failOnPlugins: [] },
    { name: "host enable refused", available: true, failOnPlugins: ["test-plugin@real-catalog"] },
  ])("does not add a project dependency after $name", async (failure) => {
    const ref = "test-plugin@real-catalog";
    const activator = new FakeHostActions(failure);
    const { sync, projectRepo, machineRepo } = await singleListedCatalog({
      tools: syntheticNativeCatalog(tool, "list-command"),
      tool,
      projectRoot: "/B",
      machine: manifestWithTool(tool),
      activator,
    });
    machineRepo.records.set(tool, {
      binary: tool,
      marketplaces: [{ alias: "local-catalog", hostName: "real-catalog" }],
      pluginRefs: [],
      pluginClaims: [{ ref, dependents: ["/A"] }],
    });

    const result = await sync.execute({ projectRoot: "/B" });

    expect(result.errors).toEqual([]);
    expect(projectRepo.records.get(tool)?.pluginRefs ?? []).toEqual([]);
    expect(machineRepo.records.get(tool)?.pluginClaims).toEqual([{ ref, dependents: ["/A"] }]);
    if (failure.available) {
      expect(result.warnings).toEqual([expect.stringContaining("enable plugin")]);
      expect(activator.enabledPlugins).toEqual([]);
    } else {
      expect(result.binaryMissing).toEqual([{ toolId: tool, binary: tool }]);
      expect(activator.addedMarketplaces).toEqual([]);
    }
  });

  it("does not enable or claim a global ref when the host plugin registry cannot be read", async () => {
    const activator = new FakeHostActions({ available: true });
    const { sync, projectRepo, machineRepo } = await singleListedCatalog({
      tools: syntheticNativeCatalog(tool, "list-command"),
      tool,
      projectRoot: "/B",
      machine: manifestWithTool(tool),
      activator,
      hostPluginRegistries: unreadableHostPlugins(tool),
    });

    const result = await sync.execute({ projectRoot: "/B" });

    expect(result.errors).toEqual([
      { scope: tool, error: new Error("host plugin registry unreadable") },
    ]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(projectRepo.records.get(tool)?.pluginRefs ?? []).toEqual([]);
    expect(machineRepo.records.get(tool)?.pluginClaims ?? []).toEqual([]);
  });

  it("does not attach to a foreign enabled host ref just because another catalog has the same plugin name", async () => {
    const otherRef = "test-plugin@other-catalog";
    const activator = new FakeHostActions({ available: true });
    const { sync, projectRepo, machineRepo } = await singleListedCatalog({
      tools: syntheticNativeCatalog(tool, "list-command"),
      tool,
      projectRoot: "/B",
      machine: manifestWithTool(tool),
      activator,
      hostPluginRegistries: new Map([
        [
          tool,
          {
            read: async () => ({
              location: "/host/registry",
              refs: new Map([["test-plugin@real-catalog", { enabled: true }]]),
            }),
          },
        ],
      ]),
    });
    machineRepo.records.set(tool, {
      binary: tool,
      marketplaces: [{ alias: "other", hostName: "other-catalog" }],
      pluginRefs: [],
      pluginClaims: [{ ref: otherRef, dependents: ["/A"] }],
    });

    const result = await sync.execute({ projectRoot: "/B" });

    expect(result.errors).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(projectRepo.records.get(tool)?.pluginRefs).toEqual([]);
    expect(machineRepo.records.get(tool)?.pluginClaims).toEqual([
      { ref: otherRef, dependents: ["/A"] },
    ]);
  });
});
