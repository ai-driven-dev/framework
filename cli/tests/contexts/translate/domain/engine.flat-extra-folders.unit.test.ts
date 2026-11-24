import { describe, expect, it } from "vitest";
import { translate } from "../../../../src/contexts/translate/domain/engine.js";
import type { ToolBuildContract } from "../../../../src/shared/domain/materialization/build-contract.js";
import { SOURCE_PLUGIN_ROOT_TOKEN } from "../../../../src/shared/domain/materialization/plugin-root-path-rewrite.js";
import { aCanon } from "../testing/canon-distribution.builder.js";
import { aStubBuildContract, aSupportedArtifact } from "../testing/stub-build-contract.builder.js";

const ROOT = SOURCE_PLUGIN_ROOT_TOKEN;
const MCP = JSON.stringify({
  mcpServers: { db: { command: "node", args: [`${ROOT}/bin/server.js`] } },
});
const HOOKS = JSON.stringify({
  hooks: { Stop: [{ hooks: [{ type: "command", command: `${ROOT}/scripts/check.sh` }] }] },
});

function contract(): ToolBuildContract {
  const stub = aStubBuildContract();
  return {
    ...stub,
    artifacts: {
      ...stub.artifacts,
      mcp: aSupportedArtifact({ mcpServersKey: "mcpServers" }),
      hooks: aSupportedArtifact({
        placement: { kind: "hooks", scriptsDir: ".stub/" },
        hooksFile: {
          at: { own: ".stub/" },
          merge: (_existing, { json, locate }) => ({
            content: `${json}|${locate?.("scripts/check.sh")}`,
            warnings: [],
          }),
        },
      }),
    },
  };
}

function flatBuild(files: Record<string, string>) {
  return translate(aCanon("plug", files), {
    kind: "build",
    mode: "flat",
    outDir: "/out",
    contract: contract(),
  });
}

const FILES = {
  ".mcp.json": MCP,
  "hooks/hooks.json": HOOKS,
  "bin/server.js": "server",
  "scripts/check.sh": "check",
  "docs/guide.md": "guide",
};

describe("the folders a flat build's commands name", () => {
  it("copies each named folder under the plugin's name, and only those", () => {
    const paths = flatBuild(FILES).files.map((file) => file.relativePath);
    expect(paths).toContain("plug/bin/server.js");
    expect(paths).toContain("plug/scripts/check.sh");
    expect(paths.some((path) => path.includes("docs"))).toBe(false);
  });

  it("points an MCP command at the copied folder", () => {
    const servers = flatBuild(FILES).mcp?.servers;
    expect(JSON.stringify(servers)).toContain("/out/plug/bin/server.js");
  });

  it("points a hook command at the copied folder", () => {
    const own = flatBuild(FILES).files.find(
      (file) => file.relativePath === ".stub/plug.hooks.json"
    );
    expect(own?.content).toContain("|./plug/scripts/check.sh");
  });
});
