import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../../src/contexts/tools/domain/build-contract.js";
import { buildKiloFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/kilo/build.js";
import { InMemoryFileAdapter } from "../../../../../helpers/ports/in-memory-file-adapter.js";

function supported(artifact: ArtifactContract): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("artifact is declared unsupported");
  return artifact;
}

describe("buildKiloFlatContract", () => {
  it("places agents, skills, hook scripts and its generated bridge under .kilo", () => {
    const { artifacts } = buildKiloFlatContract();
    expect(supported(artifacts.agents).path("aidd-dev", "agents/reviewer.md")).toBe(
      ".kilo/agents/aidd-dev-reviewer.md"
    );
    expect(supported(artifacts.skills).path("aidd-dev", "skills/01-plan/SKILL.md")).toBe(
      ".kilo/skills/aidd-dev/01-plan/SKILL.md"
    );
    const hooks = supported(artifacts.hooks);
    expect(hooks.path("aidd-context", "hooks/update_memory.js")).toBe(
      ".kilo/hooks/aidd-context/update_memory.js"
    );
    expect(hooks.path("aidd-context", "hooks/kilo-plugin.js")).toBe(".kilo/plugin/aidd-context.js");
    expect(hooks.hooksBridge?.path("aidd-context")).toBe(".kilo/plugin/aidd-context-hooks.js");
  });

  it("writes Kilo's base config and Kilo-compatible MCP entries", async () => {
    const fs = new InMemoryFileAdapter({
      "/source/plugins/aidd-dev/.mcp.json": JSON.stringify({
        mcpServers: { context: { command: "node", args: ["server.js"] } },
      }),
    });
    await buildKiloFlatContract().emitConfigArtifact?.(
      ["aidd-dev"],
      "/out",
      "/source",
      fs,
      { validate: () => undefined },
      {
        loadConfigAsset: () => ({
          $schema: "https://app.kilo.ai/config.json",
          instructions: [".kilo/rules/**/*.md"],
        }),
        loadSchema: () => ({}),
      }
    );

    expect(JSON.parse(fs.getFile("/out/kilo.json") ?? "null")).toEqual({
      $schema: "https://app.kilo.ai/config.json",
      instructions: [".kilo/rules/**/*.md"],
      mcp: {
        "aidd-dev-context": { type: "local", command: ["node", "server.js"], enabled: true },
      },
    });
  });
});
