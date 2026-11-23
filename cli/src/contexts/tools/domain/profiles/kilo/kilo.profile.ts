import { join } from "node:path";
import kiloJson from "../../../../../../assets/configs/kilo/kilo.json" with { type: "json" };
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import { MCP_CONFIG_REF } from "../../../contract/config-refs.js";
import { declareBridgeHooks } from "../../bridges/event-bridge.js";
import {
  buildAiddCommandFilePath,
  convertCommandFrontmatterNoHint,
} from "../../formats/command.js";
import { flatHooksSupport } from "../../formats/hooks/flat-routes.js";
import { toTypedMcpSection } from "../../formats/mcp/typed-mcp-section.js";
import { descriptionOnlyRule } from "../../formats/rule-frontmatter.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { flatGlobalFilePath, flatPlacement } from "../../sections/layout-section.js";
import { McpConfigPart } from "../../sections/mcp-section.js";
import { ModelsSection } from "../../sections/models-section.js";
import { kiloAgentFrontmatter } from "./kilo-agent.model.js";
import { buildKiloFlatContract } from "./kilo-build.model.js";
import { KILO_DIRECTORY, KILO_OUTPUT_PATH_CANDIDATES } from "./kilo-paths.model.js";

const TOOL_SUFFIX = ".kilo.md";

/** Where a flat build, and a flat install, put kilo's skills and agents. */
const KILO_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(KILO_DIRECTORY, {
  skills: "nested",
  agent: { ext: ".md" },
});

const hooks = declareBridgeHooks(
  { toolId: "kilo", directory: KILO_DIRECTORY },
  ["session.created", "tool.execute.after", "session.idle"],
  { loaderEntry: { dir: `${KILO_DIRECTORY}plugin/`, baseName: "kilo-plugin.js" } }
);
const hooksDelivery = flatHooksSupport(hooks);

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
  buildContracts: { flat: () => buildKiloFlatContract(hooks, KILO_FLAT_LAYOUT) },

  capabilities: (bound) => ({
    agents: bound.agents({
      format: "markdown",
      frontmatter: kiloAgentFrontmatter,
    }),
    skills: bound.skills({}),
    commands: bound.commands({
      buildInstallPath: (fileName) => buildAiddCommandFilePath(KILO_DIRECTORY, fileName),
      convertFrontmatter: convertCommandFrontmatterNoHint,
    }),
    rules: bound.rules({
      buildInstallPath: bound.installUnder("rules/"),
      convertFrontmatter: descriptionOnlyRule,
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
      artifacts: KILO_FLAT_LAYOUT,
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

  linkSyntax: [
    { from: /(@?)\.kilo\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g, to: "$1.kilo/commands/aidd/$2/$3" },
  ],
});
