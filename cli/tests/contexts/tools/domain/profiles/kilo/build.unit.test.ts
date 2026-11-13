import { describe, expect, it } from "vitest";
import type {
  ConfigArtifact,
  ConfigArtifactFile,
} from "../../../../../../src/contexts/tools/contract/build-contract.js";
import { buildKiloFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/kilo/build.js";
import { KiloDualConfigError } from "../../../../../../src/shared/domain/errors.js";
import { supported } from "../../../testing/build-artifacts.js";

function configArtifactOf(): ConfigArtifact {
  const step = buildKiloFlatContract().configArtifact;
  if (step === undefined) throw new Error("kilo flat declares no config artifact");
  return step;
}

function emit(input: {
  builtPlugins?: readonly string[];
  pluginMcp?: ReadonlyMap<string, string>;
  existing?: Readonly<Record<string, string>>;
  asset?: string | Record<string, unknown>;
}): readonly ConfigArtifactFile[] {
  return configArtifactOf().emit({
    builtPlugins: input.builtPlugins ?? [],
    pluginMcp: input.pluginMcp ?? new Map(),
    existing: new Map(Object.entries(input.existing ?? {})),
    present: new Set(),
    assets: new Map([["kilo.json", input.asset ?? { $schema: "https://app.kilo.ai/config.json" }]]),
  });
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

  it("drops the name from a flat agent: Kilo names it after its file", () => {
    const transform = supported(buildKiloFlatContract().artifacts.agents).transform;
    expect(transform?.("---\nname: x\ndescription: Reads\n---\nBody.\n", "aidd-dev", "x.md")).toBe(
      "---\ndescription: 'Reads'\nmode: 'subagent'\n---\nBody.\n"
    );
  });

  it("reads every config file Kilo may keep, beside its artifacts and at the root", () => {
    expect(configArtifactOf().reads([])).toStrictEqual([
      ".kilo/kilo.json",
      ".kilo/kilo.jsonc",
      "kilo.json",
      "kilo.jsonc",
    ]);
    expect(configArtifactOf().assets).toStrictEqual({ tool: "kilo", names: ["kilo.json"] });
    expect(configArtifactOf().probes(["aidd-dev"])).toStrictEqual([]);
  });

  it("writes Kilo's project-local base config and Kilo-compatible MCP entries", () => {
    const files = emit({
      builtPlugins: ["aidd-dev"],
      pluginMcp: new Map([
        [
          "aidd-dev",
          JSON.stringify({ mcpServers: { context: { command: "node", args: ["server.js"] } } }),
        ],
      ]),
    });

    expect(files.map((f) => f.path)).toStrictEqual([".kilo/kilo.jsonc"]);
    expect(JSON.parse(files[0]?.content ?? "null")).toEqual({
      $schema: "https://app.kilo.ai/config.json",
      mcp: {
        "aidd-dev-context": { type: "local", command: ["node", "server.js"], enabled: true },
      },
    });
  });

  it("takes a bundled base config that comes as text as written", () => {
    const files = emit({ asset: '{"$schema":"https://app.kilo.ai/config.json"}' });

    expect(JSON.parse(files[0]?.content ?? "null")).toEqual({
      $schema: "https://app.kilo.ai/config.json",
    });
  });

  it("preserves existing JSONC configuration", () => {
    const jsonc = '{\n  // project-owned\n  "instructions": ["project.md"],\n  "theme": "dark",\n}';
    const once = emit({ existing: { ".kilo/kilo.jsonc": jsonc } });
    const twice = emit({ existing: { ".kilo/kilo.jsonc": once[0]?.content ?? "" } });

    expect(once.map((f) => f.path)).toStrictEqual([".kilo/kilo.jsonc"]);
    expect(JSON.parse(once[0]?.content ?? "null")).toEqual({
      $schema: "https://app.kilo.ai/config.json",
      instructions: ["project.md"],
      theme: "dark",
    });
    expect(twice).toStrictEqual(once);
  });

  it.each([
    [".kilo/kilo.json", ".kilo/kilo.json"],
    ["kilo.jsonc", "kilo.jsonc"],
    ["kilo.json", "kilo.json"],
  ])("writes into %s when the project already keeps it", (kept, written) => {
    const files = emit({ existing: { [kept]: "{}" } });

    expect(files.map((f) => f.path)).toStrictEqual([written]);
  });

  it.each([".kilo/kilo.json", ".kilo/kilo.jsonc"])(
    "prefers %s beside Kilo's artifacts over one at the root",
    (beside) => {
      const files = emit({ existing: { "kilo.json": "{}", [beside]: "{}" } });

      expect(files.map((f) => f.path)).toStrictEqual([beside]);
    }
  );

  it("preserves a user-owned MCP server on a generated-key collision", () => {
    const files = emit({
      builtPlugins: ["aidd-dev"],
      pluginMcp: new Map([
        [
          "aidd-dev",
          JSON.stringify({ mcpServers: { context: { command: "node", args: ["server.js"] } } }),
        ],
      ]),
      existing: {
        ".kilo/kilo.jsonc": JSON.stringify({
          mcp: { "aidd-dev-context": { type: "local", command: ["user-server"] } },
        }),
      },
    });

    const config = JSON.parse(files[0]?.content ?? "null") as {
      mcp: Record<string, { command: string[] }>;
    };
    expect(config.mcp["aidd-dev-context"].command).toEqual(["user-server"]);
  });

  it.each([
    [".kilo/kilo.json", ".kilo/kilo.jsonc"],
    ["kilo.json", "kilo.jsonc"],
  ])("rejects ambiguous Kilo config files %s and %s", (json, jsonc) => {
    expect(() => emit({ existing: { [json]: "{}", [jsonc]: "{}" } })).toThrow(KiloDualConfigError);
  });
});
