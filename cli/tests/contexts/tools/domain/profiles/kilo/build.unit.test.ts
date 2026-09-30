import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../../src/contexts/tools/domain/build-contract.js";
import { buildKiloFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/kilo/build.js";
import { KiloDualConfigError } from "../../../../../../src/kernel/errors.js";
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

  it("writes Kilo's project-local base config and Kilo-compatible MCP entries", async () => {
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
        }),
        loadSchema: () => ({}),
      }
    );

    expect(JSON.parse(fs.getFile("/out/.kilo/kilo.jsonc") ?? "null")).toEqual({
      $schema: "https://app.kilo.ai/config.json",
      mcp: {
        "aidd-dev-context": { type: "local", command: ["node", "server.js"], enabled: true },
      },
    });
  });

  it("preserves existing JSONC configuration", async () => {
    const fs = new InMemoryFileAdapter({
      "/out/.kilo/kilo.jsonc":
        '{\n  // project-owned\n  "instructions": ["project.md"],\n  "theme": "dark",\n}',
    });
    const emit = buildKiloFlatContract().emitConfigArtifact;
    const asset = {
      loadConfigAsset: () => ({
        $schema: "https://app.kilo.ai/config.json",
      }),
      loadSchema: () => ({}),
    };
    await emit?.([], "/out", "/source", fs, { validate: () => undefined }, asset);
    const once = fs.getFile("/out/.kilo/kilo.jsonc");
    await emit?.([], "/out", "/source", fs, { validate: () => undefined }, asset);

    expect(JSON.parse(once ?? "null")).toEqual({
      $schema: "https://app.kilo.ai/config.json",
      instructions: ["project.md"],
      theme: "dark",
    });
    expect(fs.getFile("/out/.kilo/kilo.jsonc")).toBe(once);
    expect(fs.getFile("/out/.kilo/kilo.json")).toBeUndefined();
  });

  it("preserves a user-owned MCP server on a generated-key collision", async () => {
    const fs = new InMemoryFileAdapter({
      "/out/.kilo/kilo.jsonc": JSON.stringify({
        mcp: {
          "aidd-dev-context": { type: "local", command: ["user-server"] },
        },
      }),
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
        loadConfigAsset: () => ({ $schema: "https://app.kilo.ai/config.json" }),
        loadSchema: () => ({}),
      }
    );

    const config = JSON.parse(fs.getFile("/out/.kilo/kilo.jsonc") ?? "null") as {
      mcp: Record<string, { command: string[] }>;
    };
    expect(config.mcp["aidd-dev-context"].command).toEqual(["user-server"]);
  });

  it("rejects ambiguous Kilo config files without modifying either", async () => {
    const fs = new InMemoryFileAdapter({
      "/out/.kilo/kilo.json": "{}",
      "/out/.kilo/kilo.jsonc": "{}",
    });
    const emit = buildKiloFlatContract().emitConfigArtifact;

    await expect(
      emit?.(
        [],
        "/out",
        "/source",
        fs,
        { validate: () => undefined },
        {
          loadConfigAsset: () => ({}),
          loadSchema: () => ({}),
        }
      )
    ).rejects.toThrow(KiloDualConfigError);
    expect(fs.getFile("/out/.kilo/kilo.json")).toBe("{}");
    expect(fs.getFile("/out/.kilo/kilo.jsonc")).toBe("{}");
  });
});
