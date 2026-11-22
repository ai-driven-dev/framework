import { describe, expect, it } from "vitest";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  manifestWithTool,
  singleCodexCatalog,
  unreadableHostPlugins,
} from "../testing/machine-projection.builder.js";

const { codex } = TOOL;

describe("a Codex plugin the host did not activate is never claimed", () => {
  it.each([
    { name: "binary unavailable", available: false, failOnPlugins: [] },
    { name: "host enable refused", available: true, failOnPlugins: ["test-plugin@real-catalog"] },
  ])("does not add a project dependency after $name", async (failure) => {
    const ref = "test-plugin@real-catalog";
    const machine = manifestWithTool(codex);
    machine.setNativeRegistrations(codex, {
      binary: "codex",
      marketplaces: [{ alias: "local-catalog", hostName: "real-catalog" }],
      pluginRefs: [],
      pluginClaims: [{ ref, dependents: ["/A"] }],
    });
    const activator = new FakeHostActions(failure);
    const { sync, projectRepo, machineRepo } = await singleCodexCatalog({
      tools: registeredTools(),
      codex: TOOL.codex,
      projectRoot: "/B",
      machine,
      activator,
    });

    const result = await sync.execute({ projectRoot: "/B" });

    expect(result.errors).toEqual([]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginRefs ?? []).toEqual([]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref, dependents: ["/A"] },
    ]);
    if (failure.available) {
      expect(result.warnings).toEqual([expect.stringContaining("enable plugin")]);
      expect(activator.enabledPlugins).toEqual([]);
    } else {
      expect(result.binaryMissing).toEqual([{ toolId: codex, binary: "codex" }]);
      expect(activator.addedMarketplaces).toEqual([]);
    }
  });

  it("does not enable or claim a global ref when the host plugin registry cannot be read", async () => {
    const activator = new FakeHostActions({ available: true });
    const { sync, projectRepo, machineRepo } = await singleCodexCatalog({
      tools: registeredTools(),
      codex: TOOL.codex,
      projectRoot: "/B",
      machine: manifestWithTool(codex),
      activator,
      hostPluginRegistries: unreadableHostPlugins(codex),
    });

    const result = await sync.execute({ projectRoot: "/B" });

    expect(result.errors).toEqual([
      { scope: "codex", error: new Error("host plugin registry unreadable") },
    ]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginRefs ?? []).toEqual([]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims ?? []).toEqual([]);
  });

  it("does not attach to a foreign enabled host ref just because another catalog has the same plugin name", async () => {
    const otherRef = "test-plugin@other-catalog";
    const machine = manifestWithTool(codex);
    machine.setNativeRegistrations(codex, {
      binary: "codex",
      marketplaces: [{ alias: "other", hostName: "other-catalog" }],
      pluginRefs: [],
      pluginClaims: [{ ref: otherRef, dependents: ["/A"] }],
    });
    const activator = new FakeHostActions({ available: true });
    const { sync, projectRepo, machineRepo } = await singleCodexCatalog({
      tools: registeredTools(),
      codex: TOOL.codex,
      projectRoot: "/B",
      machine,
      activator,
      hostPluginRegistries: new Map([
        [
          codex,
          {
            read: async () => ({
              location: "/host/registry",
              refs: new Map([["test-plugin@real-catalog", { enabled: true }]]),
            }),
          },
        ],
      ]),
    });

    const result = await sync.execute({ projectRoot: "/B" });

    expect(result.errors).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginRefs).toEqual([]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: otherRef, dependents: ["/A"] },
    ]);
  });
});
