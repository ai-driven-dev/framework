import { join } from "node:path";
import opencodeJson from "../../../../../../assets/configs/opencode/opencode.json" with {
  type: "json",
};
import opencodeEvents from "../../../../../../assets/configs/opencode/opencode-events.js.txt";
import { CONFIG_PREFIX, type ConfigRef, MCP_CONFIG_REF } from "../../../contract/config-refs.js";
import { declareBridgeHooks } from "../../bridges/event-bridge.js";
import {
  buildAiddCommandFilePath,
  convertCommandFrontmatterNoHint,
} from "../../formats/command.js";
import { flatHooksSupport } from "../../formats/hooks/flat-routes.js";
import { descriptionOnlyRule } from "../../formats/rule-frontmatter.js";
import { toTypedMcpSection } from "../../formats/typed-mcp-section.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { flatGlobalFilePath, flatPlacement } from "../../sections/layout-section.js";
import { McpConfigPart } from "../../sections/mcp-section.js";
import { ModelsSection } from "../../sections/models-section.js";
import { opencodeAgentFrontmatter } from "./opencode-agent.model.js";
import { buildOpencodeFlatContract, OPENCODE_FLAT_LAYOUT } from "./opencode-build.model.js";

const DIRECTORY = ".opencode/";
const TOOL_SUFFIX = ".opencode.md";

const OUTPUT_PATH_CANDIDATES = {
  tiers: [["opencode.json", "opencode.jsonc"]],
  fallback: "opencode.json",
  onMultipleCandidates: {
    error: { toolId: "opencode", detail: "opencode.json and opencode.jsonc exist" },
  },
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
    dir: (homedir) => join(homedir, ".config", "opencode"),
    map: flatGlobalFilePath(DIRECTORY),
  },
});

// No family OpenCode's loader scans is named "hooks", so a plugin's scripts land under
// `hooks/`, namespaced per plugin, and nothing there is ever imported.
const hooks = declareBridgeHooks(
  { toolId: "opencode", directory: DIRECTORY },
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
  buildContracts: { flat: () => buildOpencodeFlatContract(hooks) },

  capabilities: (bound) => ({
    agents: bound.agents({
      format: "markdown",
      frontmatter: opencodeAgentFrontmatter,
    }),
    skills: bound.skills({}),
    commands: bound.commands({
      buildInstallPath: (fileName) => buildAiddCommandFilePath(DIRECTORY, fileName),
      convertFrontmatter: convertCommandFrontmatterNoHint,
    }),
    rules: bound.rules({
      buildInstallPath: bound.installUnder("rules/"),
      convertFrontmatter: descriptionOnlyRule,
    }),
    mcp: {
      config: new McpConfigPart({
        outputPath: "opencode.json",
        format: "json",
        mergeStrategy: "framework-prime",
        transformContent: toTypedMcpSection,
        consumes: [MCP_CONFIG_REF, OPENCODE_CONFIG_REF],
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
  }),

  linkSyntax: [
    {
      from: /(@?)\.opencode\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
      to: "$1.opencode/commands/aidd/$2/$3",
    },
  ],
});
