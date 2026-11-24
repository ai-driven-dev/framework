import opencodeJson from "../../../assets/configs/opencode/opencode.json" with { type: "json" };
import opencodeEvents from "../../../assets/configs/opencode/opencode-events.js.txt";
// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../assets/hooks-runtime/host-bridge.cjs";
import {
  CONFIG_PREFIX,
  type ConfigRef,
  MCP_CONFIG_REF,
} from "../../contexts/tools/contract/config-refs.js";
import { buildOpencodeFlatContract } from "../../contexts/tools/domain/behaviours/opencode/opencode-build.model.js";
import { declareBridgeHooks } from "../../contexts/tools/domain/bridges/event-bridge.js";
import { agentFrontmatterOf } from "../../contexts/tools/domain/formats/agents/agent-format.js";
import {
  aiddCommandsUnder,
  convertCommandFrontmatterNoHint,
} from "../../contexts/tools/domain/formats/command.js";
import { flatHooksSupport } from "../../contexts/tools/domain/formats/hooks/flat-routes.js";
import { toTypedMcpSection } from "../../contexts/tools/domain/formats/mcp/typed-mcp-section.js";
import { descriptionOnlyRule } from "../../contexts/tools/domain/formats/rule-frontmatter.js";
import { contract } from "../../contexts/tools/domain/profile/contract-builders.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { installUnder } from "../../contexts/tools/domain/profile/tool-suffix.js";
import {
  flatGlobalFilePath,
  flatPlacement,
} from "../../contexts/tools/domain/sections/layout-section.js";
import { McpConfigPart } from "../../contexts/tools/domain/sections/mcp-section.js";
import { ModelsSection } from "../../contexts/tools/domain/sections/models-section.js";
import { JsoncWriter } from "../../contexts/tools/infrastructure/jsonc-writer.adapter.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";

/** OpenCode names an agent after its file, so no `name`; `mode: subagent` keeps it out of
 * the primary agents. V2 reads the effort as the model's `#variant`. */
const AGENT_FRONTMATTER = agentFrontmatterOf({
  keep: ["description", "model"],
  effortInModel: { open: "#" },
  set: { mode: "subagent" },
});

const DIRECTORY = ".opencode/";
const TOOL_SUFFIX = ".opencode.md";

/** Where a flat build, and a flat install, put opencode's skills and agents. */
const OPENCODE_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(".opencode/", {
  skills: "nested",
  agent: { ext: ".md" },
});

const OUTPUT_PATH_CANDIDATES = {
  tiers: [["opencode.json", "opencode.jsonc"]],
  fallback: "opencode.json",
  onMultipleCandidates: {
    error: { toolId: "opencode", detail: "opencode.json and opencode.jsonc exist" },
  },
};

/** A flat build writes into the .jsonc when the project has one, the .json otherwise. */
const FLAT_CONFIG_CANDIDATES = {
  tiers: [["opencode.jsonc"], ["opencode.json"]],
  fallback: "opencode.json",
  onMultipleCandidates: OUTPUT_PATH_CANDIDATES.onMultipleCandidates,
};

const OPENCODE_CONFIG_REF: ConfigRef = {
  name: "opencode",
  path: `${CONFIG_PREFIX}.opencode/opencode.json`,
};

/** A machine-scope install puts a plugin's skills and agents where OpenCode loads them for every
 * project: its global config directory. */
const FLAT_PLACEMENT = flatPlacement({
  artifacts: OPENCODE_FLAT_LAYOUT,
  namespacePrefix: "aidd-",
  globalFiles: {
    dir: "{home}/.config/opencode",
    map: flatGlobalFilePath(DIRECTORY),
  },
});

// No family OpenCode's loader scans is named "hooks", so a plugin's scripts land under
// `hooks/`, namespaced per plugin, and nothing there is ever imported.
const hooks = declareBridgeHooks(
  { toolId: "opencode", directory: DIRECTORY, adapter },
  ["server-init", "tool.execute.after", "session.idle"],
  {
    // The loader scans `{plugin,plugins}/*.{ts,js}`, one level: only a plugin's own module, or
    // the bridge generated for it, belongs there, renamed so two plugins cannot collide.
    loaderEntry: {
      dir: `${DIRECTORY}plugin/`,
      // The one hook filename that is, by convention, a plugin's own OpenCode plugin module.
      baseName: "opencode-plugin.js",
    },
    bridgeRuntime: {
      asset: "opencode-events.js",
      path: `${DIRECTORY}hooks/opencode-events.js`,
    },
  }
);

const hooksDelivery = flatHooksSupport(hooks);

export const opencode = defineAiTool({
  toolId: "opencode",
  distributionProbes: {
    marketplace: ["opencode.json"],
  },
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "OpenCode",
  signalDir: ".opencode/commands",
  configAssets: [
    {
      name: "opencode.json",
      content: opencodeJson,
      destination: "opencode.json",
      delivery: "install",
    },
    {
      name: hooks.bridgeRuntime.asset,
      content: opencodeEvents,
      destination: hooks.bridgeRuntime.path,
      delivery: "runtime",
    },
  ],
  hooks,
  buildContracts: {
    flat: contract(buildOpencodeFlatContract, hooks, OPENCODE_FLAT_LAYOUT, {
      agentMarkdown: { frontmatter: AGENT_FRONTMATTER },
      config: FLAT_CONFIG_CANDIDATES,
    }),
  },

  capabilities: {
    agents: {
      format: "markdown",
      frontmatter: AGENT_FRONTMATTER,
    },
    skills: {},
    commands: {
      buildInstallPath: aiddCommandsUnder(DIRECTORY),
      convertFrontmatter: convertCommandFrontmatterNoHint,
    },
    rules: {
      buildInstallPath: installUnder(DIRECTORY, TOOL_SUFFIX, "rules/"),
      convertFrontmatter: descriptionOnlyRule,
    },
    mcp: {
      config: new McpConfigPart({
        outputPath: "opencode.json",
        format: "json",
        mergeStrategy: "framework-prime",
        transformContent: toTypedMcpSection,
        consumes: [MCP_CONFIG_REF, OPENCODE_CONFIG_REF],
        writer: new JsoncWriter(),
        outputPathCandidates: OUTPUT_PATH_CANDIDATES,
      }),
    },
    // Flat mode has no `marketplaceSettings` field, and opencode's `plugin[]` array accepts
    // only npm package names: no source or version a marketplace entry could express.
    hooks: { delivery: hooksDelivery },
    layout: FLAT_PLACEMENT,
    // OpenCode loads opencode.json, then opencode.jsonc over it: the model goes in the .jsonc.
    models: new ModelsSection({
      providers: ["openai", "anthropic", "mistral"],
      providerPrefix: true,
      main: { settingsFile: "opencode.jsonc", schema: "https://opencode.ai/config.json" },
    }),
  },

  linkSyntax: [
    {
      from: /(@?)\.opencode\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
      to: "$1.opencode/commands/aidd/$2/$3",
    },
  ],
});
