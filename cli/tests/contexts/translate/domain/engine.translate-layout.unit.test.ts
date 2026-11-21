import { describe, expect, it } from "vitest";
import { translate } from "../../../../src/contexts/translate/domain/engine.js";
import { McpConfigError } from "../../../../src/shared/domain/shared.error.js";
import { registeredManifestPaths } from "../../../shared/testing/registered-manifest-probes.builder.js";
import { aCanon } from "../testing/canon-distribution.builder.js";
import { claude } from "../testing/registered-profiles.builder.js";
import { aStubBuildContract, aSupportedArtifact } from "../testing/stub-build-contract.builder.js";

// Written as a split literal to avoid biome's noTemplateCurlyInString warning.
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
const MERGES = {
  merge: () => ({ mergedContent: "", collisions: [] }),
  mergeDest: (outDir: string) => `${outDir}/mcp.json`,
};

function flatContract(mcp = aSupportedArtifact(MERGES)) {
  const contract = aStubBuildContract();
  return {
    ...contract,
    artifacts: {
      ...contract.artifacts,
      mcp,
      hooks: aSupportedArtifact({ path: (plugin, rel) => `hooks/${plugin}/${rel}` }),
    },
  };
}

function build(files: Record<string, string>, contract = flatContract()) {
  return translate(aCanon("plug", files), {
    kind: "build",
    contract,
    mode: "flat",
    outDir: "/out",
  });
}

describe("translate with a build layout", () => {
  it("hands the sink the hooks file the canon declares", () => {
    const result = build({ "hooks/hooks.json": '{"hooks":{}}', "hooks/run.sh": "echo" });

    expect(result.hooks).toBe('{"hooks":{}}');
  });

  it("hands the sink no hooks file for a canon that declares none", () => {
    expect(build({ "hooks/run.sh": "echo" }).hooks).toBeNull();
  });

  it("hands the sink the plugin's MCP servers, prefixed and pointed at the plugin's root", () => {
    const result = build({
      ".mcp.json": JSON.stringify({ mcpServers: { db: { args: [`${ROOT}/hooks/run.sh`] } } }),
    });

    expect(result.mcp?.servers).toEqual({ "plug-db": { args: ["/out/hooks/plug/hooks/run.sh"] } });
  });

  it("hands the sink the plugin's whole MCP declaration, pointed at the plugin's root and its keys prefixed", () => {
    const declared = JSON.stringify({ mcpServers: { db: { args: [`${ROOT}/hooks/run.sh`] } } });

    expect(JSON.parse(build({ ".mcp.json": declared }).mcp?.declared ?? "")).toEqual({
      mcpServers: { "plug-db": { args: ["/out/hooks/plug/hooks/run.sh"] } },
    });
  });

  it("hands the sink no MCP servers for a canon that declares none", () => {
    expect(build({ "hooks/run.sh": "echo" }).mcp).toBeNull();
  });

  it("names the plugin whose MCP declaration cannot be parsed", () => {
    expect(() => build({ ".mcp.json": "{ not json" })).toThrow(McpConfigError);
  });

  it("leaves a malformed MCP declaration alone for a tool that merges none of it", () => {
    const contract = flatContract({ supported: false });

    expect(build({ ".mcp.json": "{ not json" }, contract).mcp).toBeNull();
  });

  it("hands the sink nothing to merge in the marketplace layout", () => {
    const result = translate(aCanon("plug", { "hooks/hooks.json": "{}", ".mcp.json": "{}" }), {
      kind: "build",
      contract: flatContract(),
      mode: "marketplace",
      outDir: "/out",
    });

    expect([result.hooks, result.mcp]).toEqual([null, null]);
  });
});

describe("translate with an install layout", () => {
  it("hands the sink neither a hooks file nor MCP servers to merge", () => {
    const result = translate(aCanon("plug", { "hooks/hooks.json": "{}", ".mcp.json": "{}" }), {
      kind: "install",
      tool: claude,
      manifestPaths: registeredManifestPaths(),
    });

    expect([result.hooks, result.mcp]).toEqual([null, null]);
  });
});
