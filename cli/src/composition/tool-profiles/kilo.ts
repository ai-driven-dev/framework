import { join } from "node:path";
import kiloJson from "../../../assets/configs/kilo/kilo.json" with { type: "json" };
import { MCP_CONFIG_REF } from "../../contexts/tools/contract/config-refs.js";
import { kiloAgentFrontmatter } from "../../contexts/tools/domain/behaviours/kilo/kilo-agent.model.js";
import { buildKiloFlatContract } from "../../contexts/tools/domain/behaviours/kilo/kilo-build.model.js";
import {
  KILO_DIRECTORY,
  KILO_OUTPUT_PATH_CANDIDATES,
} from "../../contexts/tools/domain/behaviours/kilo/kilo-paths.model.js";
import { declareBridgeHooks } from "../../contexts/tools/domain/bridges/event-bridge.js";
import {
  buildAiddCommandFilePath,
  convertCommandFrontmatterNoHint,
} from "../../contexts/tools/domain/formats/command.js";
import { flatHooksSupport } from "../../contexts/tools/domain/formats/hooks/flat-routes.js";
import { toTypedMcpSection } from "../../contexts/tools/domain/formats/mcp/typed-mcp-section.js";
import { descriptionOnlyRule } from "../../contexts/tools/domain/formats/rule-frontmatter.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import {
  flatGlobalFilePath,
  flatPlacement,
} from "../../contexts/tools/domain/sections/layout-section.js";
import { McpConfigPart } from "../../contexts/tools/domain/sections/mcp-section.js";
import { ModelsSection } from "../../contexts/tools/domain/sections/models-section.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";

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
