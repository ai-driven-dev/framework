import { join } from "node:path";
import kiloJson from "../../../../../../assets/configs/kilo/kilo.json" with { type: "json" };
import { MCP_CONFIG_REF } from "../../../contract/config-refs.js";
import { declareBridgeHooks } from "../../bridges/event-bridge.js";
import {
  buildAiddCommandFilePath,
  convertCommandFrontmatterNoHint,
} from "../../formats/command.js";
import { flatHooksSupport } from "../../formats/hooks/flat-routes.js";
import { toTypedMcpSection } from "../../formats/typed-mcp-section.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { flatGlobalFilePath, flatPlacement } from "../../sections/layout-section.js";
import { McpConfigPart } from "../../sections/mcp-section.js";
import { ModelsSection } from "../../sections/models-section.js";
import { kiloAgentFrontmatter } from "./kilo-agent.model.js";
import { buildKiloFlatContract } from "./kilo-build.model.js";
import { generateKiloHooksBridge } from "./kilo-hooks-bridge.model.js";
import { KILO_DIRECTORY, KILO_OUTPUT_PATH_CANDIDATES } from "./kilo-paths.model.js";

const TOOL_SUFFIX = ".kilo.md";

const hooks = declareBridgeHooks(
  { toolId: "kilo", directory: KILO_DIRECTORY },
  ["session.created", "tool.execute.after", "session.idle"],
  { loaderEntry: { dir: `${KILO_DIRECTORY}plugin/`, baseName: "kilo-plugin.js" } }
);
const hooksDelivery = flatHooksSupport(hooks, generateKiloHooksBridge);

export const kilo = defineAiTool({
  toolId: "kilo",
  distributionProbes: { marketplace: ["kilo.json"] },
  directory: KILO_DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Kilo Code",
  signalDir: ".kilo/commands",
  configAssets: [
    { name: "kilo.json", content: kiloJson, destination: ".kilo/kilo.jsonc", delivery: "install" },
  ],
  hooks,
  buildContracts: { flat: () => buildKiloFlatContract(hooks) },

  capabilities: (bound) => ({
    agents: bound.agents({
      format: "markdown",
      frontmatter: kiloAgentFrontmatter,
    }),
    skills: bound.skills({
      buildInstallPath: bound.installUnder("skills/"),
      convertFrontmatter: (fm) => fm,
    }),
    commands: bound.commands({
      buildInstallPath: (fileName) => buildAiddCommandFilePath(KILO_DIRECTORY, fileName),
      convertFrontmatter: (fm, relativeFileName) =>
        convertCommandFrontmatterNoHint(fm, relativeFileName),
    }),
    rules: bound.rules({
      buildInstallPath: bound.installUnder("rules/"),
      convertFrontmatter: (fm) =>
        fm.alwaysApply === false && fm.description !== undefined
          ? { description: fm.description }
          : {},
    }),
    mcp: {
      config: new McpConfigPart({
        outputPath: "kilo.json",
        format: "json",
        mergeStrategy: "framework-prime",
        transformContent: toTypedMcpSection,
        consumes: [MCP_CONFIG_REF],
        outputPathCandidates: KILO_OUTPUT_PATH_CANDIDATES,
      }),
    },
    hooks: { delivery: hooksDelivery },
    layout: flatPlacement({
      namespacePrefix: "aidd-",
      globalFiles: {
        dir: (homedir) => join(homedir, ".config", "kilo"),
        map: flatGlobalFilePath(KILO_DIRECTORY),
      },
    }),
    models: new ModelsSection({
      providers: ["openai", "anthropic", "mistral"],
      providerPrefix: true,
    }),
  }),

  rewriteContent(content: string): string {
    return content.replace(
      /(@?)\.kilo\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
      "$1.kilo/commands/aidd/$2/$3"
    );
  },
});
