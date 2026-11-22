import { describe, expect, it } from "vitest";
import { artifactPath } from "../../../../../../src/contexts/tools/contract/artifact-path.js";
import type {
  ConfigArtifact,
  ConfigArtifactFile,
} from "../../../../../../src/contexts/tools/contract/build-contract.js";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/opencode.profile.js";
import { builtAgent } from "../../../../../shared/testing/built-agent.builder.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { sourceOf, supported } from "../../../testing/build-artifacts.builder.js";

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

function configArtifactOf(): ConfigArtifact {
  const step = present(opencode.buildContracts.flat)().configArtifact;
  if (step === undefined) throw new Error("opencode flat declares no config artifact");
  return step;
}

function emit(input: {
  builtPlugins?: readonly string[];
  pluginMcp?: ReadonlyMap<string, string>;
  existing?: Readonly<Record<string, string>>;
  present?: readonly string[];
  base?: string;
  events?: string | Record<string, unknown>;
}): readonly ConfigArtifactFile[] {
  return configArtifactOf().emit({
    builtPlugins: input.builtPlugins ?? [],
    pluginMcp: input.pluginMcp ?? new Map(),
    existing: new Map(Object.entries(input.existing ?? {})),
    present: new Set(input.present ?? []),
    assets: new Map([
      ["opencode.json", input.base ?? { $schema: "https://opencode.ai/config.json" }],
      ["opencode-events.js", input.events ?? "export async function setupOpencodeEvents() {}"],
    ]),
  });
}

describe("present(opencode.buildContracts.flat)()", () => {
  it("reads both config spellings, and only checks each plugin's native and generated loader exists", () => {
    expect(configArtifactOf().reads(["aidd-dev"])).toStrictEqual([
      "opencode.jsonc",
      "opencode.json",
    ]);
    expect(configArtifactOf().probes(["aidd-dev"])).toStrictEqual([
      ".opencode/plugin/aidd-dev.js",
      ".opencode/plugin/aidd-dev-hooks.js",
    ]);
    expect(configArtifactOf().assets).toStrictEqual({
      tool: TOOL.opencode,
      names: ["opencode.json", "opencode-events.js"],
    });
  });

  it.each(["aidd-dev.js", "aidd-dev-hooks.js"])(
    "delivers one shared adapter outside plugin discovery when %s was built",
    (entry) => {
      const adapter = "export async function setupOpencodeEvents() {}";
      const files = emit({
        builtPlugins: ["aidd-dev", "aidd-pm"],
        present: [`.opencode/plugin/${entry}`],
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
        present: [".opencode/plugin/aidd-dev.js"],
        events: {},
      })
    ).toThrow(new TypeError("OpenCode event adapter must be source text"));
  });

  it("writes no manifest and no marketplace of its own", () => {
    const contract = present(opencode.buildContracts.flat)();

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
    const { artifacts } = present(opencode.buildContracts.flat)();

    expect({
      skills: sourceOf(artifacts.skills),
      agents: sourceOf(artifacts.agents),
      hooks: sourceOf(artifacts.hooks),
      mcp: artifacts.mcp,
    }).toStrictEqual({
      skills: { kind: "fullTree", srcDir: "skills" },
      agents: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
      hooks: { kind: "hooksBundle", jsonPath: "hooks/hooks.json", scriptDir: "hooks" },
      mcp: { supported: false, reason: "carried by the config artifact (opencode.json mcp)" },
    });
  });

  it("declares an agent a subagent, leaves its ID to the file name, and points its references at their flat destinations", () => {
    const transform = builtAgent(present(opencode.buildContracts.flat)(), "flat");

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
    const hooks = supported(present(opencode.buildContracts.flat)().artifacts.hooks);

    expect({
      loaderEntry: artifactPath(hooks, "aidd-dev", "hooks/opencode-plugin.js"),
      script: artifactPath(hooks, "aidd-dev", "hooks/journal.cjs"),
      skipHooksJson: hooks.skipHooksJson,
      bridgeDir: hooks.hooksBridge?.dir,
      skipIfSourceHas: hooks.hooksBridge?.skipIfSourceHas,
    }).toStrictEqual({
      loaderEntry: ".opencode/plugin/aidd-dev.js",
      script: ".opencode/hooks/aidd-dev/journal.cjs",
      skipHooksJson: true,
      bridgeDir: ".opencode/plugin/",
      skipIfSourceHas: "opencode-plugin.js",
    });
  });

  it("generates no bridge for a plugin whose hooks name no event OpenCode delivers", () => {
    const hooks = supported(present(opencode.buildContracts.flat)().artifacts.hooks);

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
        ["aidd-dev", JSON.stringify({ mcpServers: { "aidd-dev-context": { command: "node" } } })],
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

describe("opencode flat hooks path", () => {
  const hooks = supported(present(opencode.buildContracts.flat)().artifacts.hooks);
  const path = (plugin: string, rel: string) => artifactPath(hooks, plugin, rel);

  it("namespaces a plain hook script under .opencode/hooks/<plugin>/", () => {
    expect(path("aidd-context", "hooks/update_memory.js")).toBe(
      ".opencode/hooks/aidd-context/update_memory.js"
    );
  });

  it("renames a plugin's own opencode-plugin.js flat into .opencode/plugin/<plugin>.js", () => {
    expect(path("aidd-telemetry", "hooks/opencode-plugin.js")).toBe(
      ".opencode/plugin/aidd-telemetry.js"
    );
  });

  it("keeps two plugins' same-named hook script from colliding", () => {
    const a = path("plugin-a", "hooks/x.js");
    const b = path("plugin-b", "hooks/x.js");
    expect(a).toBe(".opencode/hooks/plugin-a/x.js");
    expect(b).toBe(".opencode/hooks/plugin-b/x.js");
    expect(a).not.toBe(b);
  });
});
