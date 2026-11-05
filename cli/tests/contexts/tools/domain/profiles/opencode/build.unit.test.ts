import { describe, expect, it } from "vitest";
import type {
  ArtifactContract,
  ArtifactSource,
  ConfigArtifact,
  ConfigArtifactFile,
} from "../../../../../../src/contexts/tools/domain/build-contract.js";
import {
  buildOpencodeFlatContract,
  transformMcpToOpencode,
} from "../../../../../../src/contexts/tools/domain/profiles/opencode/build.js";

// Built, not written literally: biome reads a string holding "${...}" as a lost template.
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

const AGENT_SOURCE = [
  "---",
  "name: planner",
  "description: Plans the work",
  "---",
  `Read @${ROOT}/skills/01-plan/SKILL.md`,
  `Ask @${ROOT}/agents/reviewer.md`,
  `Run @${ROOT}/hooks/journal.cjs`,
  "",
].join("\n");

function supported(artifact: ArtifactContract): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("artifact is declared unsupported");
  return artifact;
}

function sourceOf(artifact: ArtifactContract): ArtifactSource | null {
  return artifact.supported ? artifact.source : null;
}

function configArtifactOf(): ConfigArtifact {
  const step = buildOpencodeFlatContract().configArtifact;
  if (step === undefined) throw new Error("opencode flat declares no config artifact");
  return step;
}

function emit(input: {
  builtPlugins?: readonly string[];
  pluginMcp?: ReadonlyMap<string, string>;
  existing?: Readonly<Record<string, string>>;
  base?: string;
  events?: string | Record<string, unknown>;
}): readonly ConfigArtifactFile[] {
  return configArtifactOf().emit({
    builtPlugins: input.builtPlugins ?? [],
    pluginMcp: input.pluginMcp ?? new Map(),
    existing: new Map(Object.entries(input.existing ?? {})),
    assets: new Map([
      ["opencode.json", input.base ?? { $schema: "https://opencode.ai/config.json" }],
      ["opencode-events.js", input.events ?? "export async function setupOpencodeEvents() {}"],
    ]),
  });
}

describe("transformMcpToOpencode()", () => {
  it("turns a command server into a local one, its arguments folded into the command line", () => {
    const converted = transformMcpToOpencode(
      JSON.stringify({
        mcpServers: { context: { command: "npx", args: ["-y", "server"], env: { KEY: "v" } } },
      })
    );

    expect(JSON.parse(converted)).toStrictEqual({
      mcp: {
        context: {
          type: "local",
          command: ["npx", "-y", "server"],
          enabled: true,
          environment: { KEY: "v" },
        },
      },
    });
  });

  it("turns a url server into a remote one, and a disabled server into a disabled one", () => {
    const converted = transformMcpToOpencode(
      JSON.stringify({ mcpServers: { hosted: { url: "https://example.test", disabled: true } } })
    );

    expect(JSON.parse(converted)).toStrictEqual({
      mcp: { hosted: { type: "remote", url: "https://example.test", enabled: false } },
    });
  });

  it("refuses a server that names neither a command nor a url", () => {
    expect(() => transformMcpToOpencode(JSON.stringify({ mcpServers: { broken: {} } }))).toThrow(
      /broken/
    );
  });

  it("refuses a config that is not a JSON object", () => {
    expect(() => transformMcpToOpencode("[]")).toThrow("MCP config must be a JSON object");
    expect(() => transformMcpToOpencode("{ not json")).toThrow(/Cannot parse MCP config/);
  });

  it("refuses a config that is null or a bare value", () => {
    expect(() => transformMcpToOpencode("null")).toThrow("MCP config must be a JSON object");
    expect(() => transformMcpToOpencode("42")).toThrow("MCP config must be a JSON object");
  });
});

describe("buildOpencodeFlatContract()", () => {
  it("reads both config spellings and each plugin's native and generated loader", () => {
    expect(configArtifactOf().reads(["aidd-dev"])).toStrictEqual([
      "opencode.jsonc",
      "opencode.json",
      ".opencode/plugin/aidd-dev.js",
      ".opencode/plugin/aidd-dev-hooks.js",
    ]);
    expect(configArtifactOf().assets).toStrictEqual({
      tool: "opencode",
      names: ["opencode.json", "opencode-events.js"],
    });
  });

  it.each(["aidd-dev.js", "aidd-dev-hooks.js"])(
    "delivers one shared adapter outside plugin discovery when %s was built",
    (entry) => {
      const adapter = "export async function setupOpencodeEvents() {}";
      const files = emit({
        builtPlugins: ["aidd-dev", "aidd-pm"],
        existing: { [`.opencode/plugin/${entry}`]: "plugin" },
        events: adapter,
      });

      expect(files).toStrictEqual([
        { path: "opencode.json", content: expect.any(String) },
        { path: ".opencode/hooks/opencode-events.js", content: adapter },
      ]);
    }
  );

  it("delivers no adapter when no plugin built a loader", () => {
    const files = emit({ builtPlugins: ["aidd-dev"] });

    expect(files.map((f) => f.path)).toStrictEqual(["opencode.json"]);
  });

  it("refuses an event adapter that is not source text", () => {
    expect(() =>
      emit({
        builtPlugins: ["aidd-dev"],
        existing: { ".opencode/plugin/aidd-dev.js": "plugin" },
        events: {},
      })
    ).toThrow(new TypeError("OpenCode event adapter must be source text"));
  });

  it("writes no manifest and no marketplace of its own", () => {
    const contract = buildOpencodeFlatContract();

    expect({
      manifestFileRelative: contract.manifestFileRelative,
      synthesizeManifest: contract.synthesizeManifest,
      manifestSchemaName: contract.manifestSchemaName,
      buildMarketplaceCatalog: contract.buildMarketplaceCatalog,
      buildMarketplaceEntry: contract.buildMarketplaceEntry,
    }).toStrictEqual({
      manifestFileRelative: null,
      synthesizeManifest: null,
      manifestSchemaName: null,
      buildMarketplaceCatalog: null,
      buildMarketplaceEntry: null,
    });
  });

  it("sources skills, agents and hooks from the plugin tree, and leaves mcp to the config artifact", () => {
    const { artifacts } = buildOpencodeFlatContract();

    expect({
      skills: sourceOf(artifacts.skills),
      agents: sourceOf(artifacts.agents),
      hooks: sourceOf(artifacts.hooks),
      mcp: artifacts.mcp,
      rules: artifacts.rules,
      commands: artifacts.commands,
    }).toStrictEqual({
      skills: { kind: "fullTree", srcDir: "skills" },
      agents: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
      hooks: { kind: "hooksBundle", jsonPath: "hooks/hooks.json", scriptDir: "hooks" },
      mcp: { supported: false },
      rules: { supported: false },
      commands: { supported: false },
    });
  });

  it("nests a plugin's whole skills tree under its own folder, and renames the skill itself", () => {
    const skills = supported(buildOpencodeFlatContract().artifacts.skills);

    expect({
      path: skills.path("aidd-dev", "skills/01-plan/SKILL.md"),
      rewriteSkillName: skills.rewriteSkillName,
    }).toStrictEqual({
      path: ".opencode/skills/aidd-dev/01-plan/SKILL.md",
      rewriteSkillName: true,
    });
  });

  it("prefixes a flat agent's file with the plugin name and keeps it markdown", () => {
    const agents = supported(buildOpencodeFlatContract().artifacts.agents);

    expect(agents.path("aidd-dev", "agents/planner.md")).toBe(
      ".opencode/agents/aidd-dev-planner.md"
    );
  });

  it("declares an agent a subagent, leaves its ID to the file name, and points its references at their flat destinations", () => {
    const transform = supported(buildOpencodeFlatContract().artifacts.agents).transform;

    expect(transform?.(AGENT_SOURCE, "aidd-dev", "planner.md")).toBe(
      [
        "---",
        "description: 'Plans the work'",
        "mode: 'subagent'",
        "---",
        "Read [SKILL.md](../skills/aidd-dev/01-plan/SKILL.md)",
        "Ask [reviewer.md](./aidd-dev-reviewer.md)",
        "Run [journal.cjs](../../hooks/journal.cjs)",
        "",
      ].join("\n")
    );
  });

  it("delivers a plugin's own OpenCode module where the loader scans, and every other script apart", () => {
    const hooks = supported(buildOpencodeFlatContract().artifacts.hooks);

    expect({
      loaderEntry: hooks.path("aidd-dev", "hooks/opencode-plugin.js"),
      script: hooks.path("aidd-dev", "hooks/journal.cjs"),
      skipHooksJson: hooks.skipHooksJson,
      bridgePath: hooks.hooksBridge?.path("aidd-dev"),
      skipIfSourceHas: hooks.hooksBridge?.skipIfSourceHas,
    }).toStrictEqual({
      loaderEntry: ".opencode/plugin/aidd-dev.js",
      script: ".opencode/hooks/aidd-dev/journal.cjs",
      skipHooksJson: true,
      bridgePath: ".opencode/plugin/aidd-dev-hooks.js",
      skipIfSourceHas: "opencode-plugin.js",
    });
  });

  it("generates no bridge for a plugin whose hooks name no event OpenCode delivers", () => {
    const hooks = supported(buildOpencodeFlatContract().artifacts.hooks);

    expect(
      hooks.hooksBridge?.generate(
        JSON.stringify({ hooks: { Notification: [{ hooks: [{ command: "x" }] }] } }),
        "aidd-dev"
      )
    ).toBeNull();
  });

  it("writes one opencode.json holding the bundled base, the user's own keys and every plugin's mcp servers", () => {
    const files = emit({
      builtPlugins: ["aidd-dev"],
      pluginMcp: new Map([
        ["aidd-dev", JSON.stringify({ mcpServers: { context: { command: "node" } } })],
      ]),
      existing: { "opencode.json": JSON.stringify({ theme: "dark" }) },
    });

    expect(files.map((f) => f.path)).toStrictEqual(["opencode.json"]);
    expect(JSON.parse(files[0]?.content ?? "null")).toStrictEqual({
      $schema: "https://opencode.ai/config.json",
      theme: "dark",
      mcp: {
        "aidd-dev-context": { type: "local", command: ["node"], enabled: true },
      },
    });
  });

  it("writes into the jsonc config when the project already keeps one", () => {
    const files = emit({
      existing: { "opencode.jsonc": JSON.stringify({ theme: "dark" }), "opencode.json": "{}" },
    });

    expect(files.map((f) => f.path)).toStrictEqual(["opencode.jsonc"]);
    expect(JSON.parse(files[0]?.content ?? "null")).toMatchObject({ theme: "dark" });
  });

  it("takes a bundled base config that comes as text as written", () => {
    const files = emit({ base: '{"$schema":"https://opencode.ai/config.json"}' });

    expect(JSON.parse(files[0]?.content ?? "null")).toStrictEqual({
      $schema: "https://opencode.ai/config.json",
    });
  });
});
