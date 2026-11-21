import { describe, expect, it } from "vitest";
import {
  writePluginHooks,
  writePluginMcp,
} from "../../../../../src/contexts/translate/application/sinks/plugin-runtime-writer.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { aDiskTarget, aStubBuildContract } from "../../testing/stub-build-contract.builder.js";

const PLUGIN = { name: "plug", src: "/src/plugins/plug" };
const UNUSED_FLAT = {
  writeConfig: async () => 0,
  writeAgent: async () => 0,
  writeHooks: async () => 0,
  writeMcp: async () => 0,
};

function depsOver(fs: InMemoryFileAdapter, logger = new CapturingLogger()) {
  return { fs, flat: UNUSED_FLAT, logger };
}

describe("one plugin's hooks and MCP servers", () => {
  it("writes no hook in the marketplace layout, which the engine builds", async () => {
    const fs = new InMemoryFileAdapter({
      [`${PLUGIN.src}/hooks/hooks.json`]: "{}",
      [`${PLUGIN.src}/hooks/run.sh`]: "echo hi",
    });
    const target = aDiskTarget(aStubBuildContract());
    await expect(writePluginHooks(depsOver(fs), target, PLUGIN)).resolves.toBe(0);
    expect(fs.getFile("/out/plugins/plug/hooks/run.sh")).toBeUndefined();
  });

  it("warns, and writes nothing, for flat hooks a tool does not support", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN.src}/hooks/hooks.json`]: "{}" });
    const logger = new CapturingLogger();
    const contract = aStubBuildContract();
    const target = aDiskTarget(
      { ...contract, artifacts: { ...contract.artifacts, hooks: { supported: false } } },
      { mode: "flat" }
    );
    await expect(writePluginHooks(depsOver(fs, logger), target, PLUGIN)).resolves.toBe(0);
    expect(logger.warnMessages).toEqual([
      "Skipping hooks/ in plugin 'plug' (hooks not supported for this target).",
    ]);
  });

  it("writes no MCP file in the marketplace layout, which the engine builds", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN.src}/.mcp.json`]: "{}" });
    const target = aDiskTarget(aStubBuildContract());
    await expect(writePluginMcp(depsOver(fs), target, PLUGIN)).resolves.toBe(0);
    expect(fs.getFile("/out/plugins/plug/.mcp.json")).toBeUndefined();
  });

  it("writes nothing when the plugin has no MCP file", async () => {
    const target = aDiskTarget(aStubBuildContract());
    await expect(writePluginMcp(depsOver(new InMemoryFileAdapter()), target, PLUGIN)).resolves.toBe(
      0
    );
  });
});
