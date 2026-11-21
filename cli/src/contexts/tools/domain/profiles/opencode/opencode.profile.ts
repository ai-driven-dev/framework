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
import { flatHooksSupport } from "../../formats/hooks/routes.js";
import { toTypedMcpSection } from "../../formats/typed-mcp-merge.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { flatGlobalFilePath, flatPlacement } from "../../sections/layout-section.js";
import { McpConfigPart } from "../../sections/mcp-section.js";
import { ModelsSection } from "../../sections/models-section.js";
import { DualConfigError } from "../../tools.error.js";
import { opencodeAgentFrontmatter } from "./opencode-agent.model.js";
import { buildOpencodeFlatContract } from "./opencode-build.model.js";
import { generateOpencodeHooksBridge } from "./opencode-hooks-bridge.model.js";

const DIRECTORY = ".opencode/";
const TOOL_SUFFIX = ".opencode.md";

const OPENCODE_CONFIG_REF: ConfigRef = {
  name: "opencode",
  path: `${CONFIG_PREFIX}.opencode/opencode.json`,
};

/** A machine-scope install puts a plugin's skills and agents where OpenCode loads them for every
 * project: its global config directory. */
const globalFilePath = flatGlobalFilePath(DIRECTORY);

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

const hooksDelivery = flatHooksSupport(hooks, generateOpencodeHooksBridge);

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
    skills: bound.skills({
      buildInstallPath: bound.installUnder("skills/"),
      convertFrontmatter: (fm) => fm,
    }),
    commands: bound.commands({
      buildInstallPath: (fileName) => buildAiddCommandFilePath(DIRECTORY, fileName),
      convertFrontmatter: (fm, relativeFileName) =>
        convertCommandFrontmatterNoHint(fm, relativeFileName),
    }),
    rules: bound.rules({
      buildInstallPath: bound.installUnder("rules/"),
      convertFrontmatter: (fm) => {
        if (fm.alwaysApply === false && fm.description !== undefined) {
          return { description: fm.description };
        }
        return {};
      },
    }),
    mcp: {
      config: new McpConfigPart({
        outputPath: "opencode.json",
        format: "json",
        mergeStrategy: "framework-prime",
        transformContent: toTypedMcpSection,
        consumes: [MCP_CONFIG_REF, OPENCODE_CONFIG_REF],
        outputPathCandidates: {
          tiers: [["opencode.json", "opencode.jsonc"]],
          fallback: "opencode.json",
          conflict: () => {
            throw new DualConfigError("opencode", "opencode.json and opencode.jsonc exist");
          },
        },
      }),
    },
    // Flat mode has no `marketplaceSettings` field, and opencode's `plugin[]` array accepts
    // only npm package names: no source or version a marketplace entry could express.
    hooks: { delivery: hooksDelivery },
    layout: flatPlacement({
      namespacePrefix: "aidd-",
      globalFiles: {
        dir: (homedir) => join(homedir, ".config", "opencode"),
        map: globalFilePath,
      },
    }),
    // OpenCode loads opencode.json, then opencode.jsonc over it: the model goes in the .jsonc.
    models: new ModelsSection({
      providers: ["openai", "anthropic", "mistral"],
      providerPrefix: true,
      main: { settingsFile: "opencode.jsonc", schema: "https://opencode.ai/config.json" },
    }),
  }),

  rewriteContent(content: string): string {
    return content.replace(
      /(@?)\.opencode\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
      "$1.opencode/commands/aidd/$2/$3"
    );
  },
});
