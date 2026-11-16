import { describe, expect, it } from "vitest";
import type {
  ArtifactContract,
  ConfigArtifact,
  ConfigArtifactFile,
} from "../../../../../../src/contexts/tools/domain/build-contract.js";
import { buildKiloFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/kilo/build.js";
import { KiloDualConfigError } from "../../../../../../src/kernel/errors.js";

function supported(artifact: ArtifactContract): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("artifact is declared unsupported");
  return artifact;
}

function configArtifactOf(): ConfigArtifact {
  const step = buildKiloFlatContract().configArtifact;
  if (step === undefined) throw new Error("kilo flat declares no config artifact");
  return step;
}

function emit(input: {
  builtPlugins?: readonly string[];
  pluginMcp?: ReadonlyMap<string, string>;
  rules?: readonly string[];
  existing?: Readonly<Record<string, string>>;
  asset?: string | Record<string, unknown>;
}): readonly ConfigArtifactFile[] {
  return configArtifactOf().emit({
    builtPlugins: input.builtPlugins ?? [],
    pluginMcp: input.pluginMcp ?? new Map(),
    rules: input.rules ?? [],
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

describe("Kilo flat Rules", () => {
  const rules = () => supported(buildKiloFlatContract().artifacts.rules);

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

  it("appends the written Rules after the user's JSONC instructions, unchanged on rebuild", () => {
    const rules = [
      ".kilo/rules/aidd-dev-style.md",
      ".kilo/rules/aidd-test-01-a-one.md",
      ".kilo/rules/aidd-test-02-b-two.md",
    ];
    const [once] = emit({
      rules,
      existing: { ".kilo/kilo.jsonc": '{\n  // mine\n  "instructions": ["z.md", "a.md"],\n}' },
    });
    const [again] = emit({ rules, existing: { ".kilo/kilo.jsonc": once?.content ?? "" } });

    expect(once?.path).toBe(".kilo/kilo.jsonc");
    expect(JSON.parse(once?.content ?? "null").instructions).toEqual(["z.md", "a.md", ...rules]);
    expect(again?.content).toBe(once?.content);
  });

  it("merges the written Rules into an existing .kilo/kilo.json", () => {
    const [file] = emit({
      rules: [".kilo/rules/aidd-test-style.md"],
      existing: { ".kilo/kilo.json": JSON.stringify({ instructions: ["mine.md"] }) },
    });
    expect(file?.path).toBe(".kilo/kilo.json");
    expect(JSON.parse(file?.content ?? "null").instructions).toEqual([
      "mine.md",
      ".kilo/rules/aidd-test-style.md",
    ]);
  });

  it("adds no instructions key when the build wrote no Rule", () => {
    const [file] = emit({});
    expect(JSON.parse(file?.content ?? "null").instructions).toBeUndefined();
  });
});
