import { describe, expect, it } from "vitest";
import {
  writePluginHooks,
  writePluginMcp,
} from "../../../../../src/contexts/translate/application/sinks/plugin-runtime-writer.js";
import type {
  FlatHooksStep,
  FlatMcpStep,
} from "../../../../../src/contexts/translate/ports/flat-plugin-writer.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import {
  aDiskTarget,
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

const MERGES = { mcpServersKey: "mcpServers" };

function depsOver(logger = new CapturingLogger()) {
  const hooks: FlatHooksStep[] = [];
  const mcp: FlatMcpStep[] = [];
  const flat = {
    writeConfig: async () => 0,
    writeHooks: async (step: FlatHooksStep) => {
      hooks.push(step);
      return 1;
    },
    writeMcp: async (step: FlatMcpStep) => {
      mcp.push(step);
      return 1;
    },
  };
  return { deps: { flat, logger }, hooks, mcp };
}

function flatTarget(over: Parameters<typeof aSupportedArtifact>[0] = {}) {
  const contract = aStubBuildContract();
  return aDiskTarget(
    { ...contract, artifacts: { ...contract.artifacts, mcp: aSupportedArtifact(over) } },
    { mode: "flat" }
  );
}

describe("one plugin's hooks and MCP servers", () => {
  it("hands the flat writer the hooks the engine handed over, with no read of the plugin's source", async () => {
    const { deps, hooks } = depsOver();

    await expect(
      writePluginHooks(deps, flatTarget(), {
        name: "plug",
        hooks: '{"hooks":{}}',
        carriesRelease: false,
      })
    ).resolves.toBe(1);
    expect(hooks.map((step) => [step.pluginName, step.hooksJson])).toEqual([
      ["plug", '{"hooks":{}}'],
    ]);
  });

  it("writes nothing for a plugin the engine handed no hooks", async () => {
    const { deps, hooks } = depsOver();
    const logger = deps.logger;

    await expect(
      writePluginHooks(deps, flatTarget(), { name: "plug", hooks: null, carriesRelease: false })
    ).resolves.toBe(0);
    expect([hooks, logger.warnMessages]).toEqual([[], []]);
  });

  it("warns, and writes nothing, for flat hooks a tool does not support", async () => {
    const { deps, hooks } = depsOver();
    const contract = aStubBuildContract();
    const target = aDiskTarget(
      {
        ...contract,
        artifacts: {
          ...contract.artifacts,
          hooks: { supported: false, reason: "off in this test" },
        },
      },
      { mode: "flat" }
    );

    await expect(
      writePluginHooks(deps, target, { name: "plug", hooks: "{}", carriesRelease: false })
    ).resolves.toBe(0);
    expect(hooks).toEqual([]);
    expect(deps.logger.warnMessages).toEqual([
      "Skipping hooks/ in plugin 'plug' (hooks not supported for this target).",
    ]);
  });

  it("hands the flat writer the servers the engine handed over", async () => {
    const { deps, mcp } = depsOver();
    const servers = { "plug-db": { command: "run" } };

    await expect(
      writePluginMcp(deps, flatTarget(MERGES), { name: "plug", mcp: { servers, declared: "{}" } })
    ).resolves.toBe(1);
    expect(mcp.map((step) => [step.pluginName, step.servers])).toEqual([["plug", servers]]);
  });

  it("writes nothing when the engine handed no MCP servers", async () => {
    const { deps, mcp } = depsOver();

    await expect(
      writePluginMcp(deps, flatTarget(MERGES), { name: "plug", mcp: null })
    ).resolves.toBe(0);
    expect(mcp).toEqual([]);
  });

  it("writes nothing for a tool that merges no MCP servers", async () => {
    const { deps, mcp } = depsOver();

    await expect(
      writePluginMcp(deps, flatTarget(), {
        name: "plug",
        mcp: { servers: { "plug-db": {} }, declared: "{}" },
      })
    ).resolves.toBe(0);
    expect(mcp).toEqual([]);
  });
});
