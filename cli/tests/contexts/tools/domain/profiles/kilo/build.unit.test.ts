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

describe("Kilo flat Rules", () => {
  const rules = () => supported(buildKiloFlatContract().artifacts.rules);
  const asset = {
    loadConfigAsset: () => ({ $schema: "https://app.kilo.ai/config.json" }),
    loadSchema: () => ({}),
  };
  const validator = { validate: () => undefined };

  it("emits each all-files Rule as one plugin-prefixed file under .kilo/rules", () => {
    expect(rules().path("aidd-test", "rules/01-standards/naming.md")).toBe(
      ".kilo/rules/aidd-test-01-standards-naming.md"
    );
  });

  it("keeps an all-files Rule's content and repoints its relative links", () => {
    const content =
      "---\ndescription: naming\n---\nSee [errors](./errors.md) and @./errors.md first\n";
    expect(rules().transform?.(content, "aidd-test", "01-standards/naming.md")).toBe(
      "---\ndescription: naming\n---\nSee [errors](./aidd-test-01-standards-errors.md) and " +
        "[errors.md](./aidd-test-01-standards-errors.md) first\n"
    );
  });

  it("reports a path-scoped Rule's scope as one Kilo cannot express, and none for an all-files Rule", () => {
    const scoped = '---\npaths:\n  - "src/**/*.ts"\n---\nTyped code only.\n';
    expect(rules().inexpressibleScope?.(scoped)).toEqual(["src/**/*.ts"]);
    expect(rules().inexpressibleScope?.("---\ndescription: x\n---\nAll.\n")).toBeUndefined();
  });

  it("never lists a path-scoped Rule in instructions", async () => {
    const fs = new InMemoryFileAdapter({
      "/source/plugins/aidd-test/rules/all.md": "all",
      "/source/plugins/aidd-test/rules/ts.md": "---\npaths:\n  - src/**/*.ts\n---\nTyped.\n",
    });
    await buildKiloFlatContract().emitConfigArtifact?.(
      ["aidd-test"],
      "/out",
      "/source",
      fs,
      validator,
      asset
    );
    expect(JSON.parse(fs.getFile("/out/.kilo/kilo.jsonc") ?? "null").instructions).toEqual([
      ".kilo/rules/aidd-test-all.md",
    ]);
  });

  it("appends sorted Rule paths after the user's JSONC instructions, unchanged on rebuild", async () => {
    const fs = new InMemoryFileAdapter({
      "/out/.kilo/kilo.jsonc": '{\n  // mine\n  "instructions": ["z.md", "a.md"],\n}',
      "/source/plugins/aidd-test/rules/02-b/two.md": "two",
      "/source/plugins/aidd-test/rules/01-a/one.md": "one",
      "/source/plugins/aidd-test/rules/01-a/notes.txt": "not a Rule",
      "/source/plugins/aidd-dev/rules/style.md": "style",
    });
    const emit = buildKiloFlatContract().emitConfigArtifact;
    await emit?.(["aidd-test", "aidd-dev"], "/out", "/source", fs, validator, asset);
    const once = fs.getFile("/out/.kilo/kilo.jsonc");
    await emit?.(["aidd-test", "aidd-dev"], "/out", "/source", fs, validator, asset);

    expect(JSON.parse(once ?? "null").instructions).toEqual([
      "z.md",
      "a.md",
      ".kilo/rules/aidd-dev-style.md",
      ".kilo/rules/aidd-test-01-a-one.md",
      ".kilo/rules/aidd-test-02-b-two.md",
    ]);
    expect(fs.getFile("/out/.kilo/kilo.jsonc")).toBe(once);
  });

  it("merges the Rule paths into an existing .kilo/kilo.json", async () => {
    const fs = new InMemoryFileAdapter({
      "/out/.kilo/kilo.json": JSON.stringify({ instructions: ["mine.md"] }),
      "/source/plugins/aidd-test/rules/style.md": "style",
    });
    await buildKiloFlatContract().emitConfigArtifact?.(
      ["aidd-test"],
      "/out",
      "/source",
      fs,
      validator,
      asset
    );
    expect(JSON.parse(fs.getFile("/out/.kilo/kilo.json") ?? "null").instructions).toEqual([
      "mine.md",
      ".kilo/rules/aidd-test-style.md",
    ]);
    expect(fs.getFile("/out/.kilo/kilo.jsonc")).toBeUndefined();
  });
});
