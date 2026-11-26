import kiloJson from "../../../assets/configs/kilo/kilo.json" with { type: "json" };
// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../assets/hooks-runtime/host-bridge.cjs";
import { MCP_CONFIG_REF } from "../../contexts/tools/contract/config-refs.js";
import { buildKiloFlatContract } from "../../contexts/tools/domain/behaviours/kilo/kilo-build.model.js";
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
import type { McpJsonDeclaration } from "../../contexts/tools/domain/profile/declared-sections.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { installUnder } from "../../contexts/tools/domain/profile/tool-suffix.js";
import {
  flatGlobalFilePath,
  flatPlacement,
} from "../../contexts/tools/domain/sections/layout-section.js";
import type { McpOutputPathCandidates } from "../../contexts/tools/domain/sections/mcp-section.js";
import { ModelsSection } from "../../contexts/tools/domain/sections/models-section.js";
import { JsoncWriter } from "../../contexts/tools/infrastructure/jsonc-writer.adapter.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";

/** Kilo names an agent after its file, reads the effort as the model's `variant`, and passes
 * any unknown key to the model provider, so only its own keys are carried. */
const KILO_DIRECTORY = ".kilo/";
const KILO_PROJECT_CONFIG_JSON = `${KILO_DIRECTORY}kilo.json`;
const KILO_PROJECT_CONFIG_JSONC = `${KILO_DIRECTORY}kilo.jsonc`;

/** Prefer the config beside Kilo's project artifacts. Existing root-level configuration stays
 * user-owned and is reused rather than creating a second configuration variant. */
export const KILO_OUTPUT_PATH_CANDIDATES: McpOutputPathCandidates = {
  tiers: [
    [KILO_PROJECT_CONFIG_JSON, KILO_PROJECT_CONFIG_JSONC],
    ["kilo.json", "kilo.jsonc"],
  ],
  fallback: KILO_PROJECT_CONFIG_JSONC,
  onMultipleCandidates: {
    error: {
      toolId: "kilo",
      detail: "Kilo JSON and JSONC config variants exist at the same location",
    },
  },
};

const AGENT_FRONTMATTER = agentFrontmatterOf({
  keep: ["description", "model", "variant"],
  rename: { variant: "effort" },
  set: { mode: "subagent" },
});

const TOOL_SUFFIX = ".kilo.md";

/** Where a flat build, and a flat install, put kilo's skills and agents. */
const KILO_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(KILO_DIRECTORY, {
  skills: "nested",
  rules: "top-level-no-frontmatter",
  agent: { ext: ".md" },
});

const hooks = declareBridgeHooks(
  { toolId: "kilo", directory: KILO_DIRECTORY, adapter },
  ["session.created", "tool.execute.after", "session.idle", "tool.execute.before", "chat.message"],
  { loaderEntry: { dir: `${KILO_DIRECTORY}plugin/`, baseName: "kilo-plugin.js" } }
);
const hooksDelivery = flatHooksSupport(hooks);

/** The MCP servers file, rewritten in place so the comments a person wrote in it stay. */
const MCP_CONFIG: McpJsonDeclaration = {
  outputPath: "kilo.json",
  format: "json",
  mergeStrategy: "framework-prime",
  transformContent: toTypedMcpSection,
  consumes: [MCP_CONFIG_REF],
  keepsComments: true,
  outputPathCandidates: KILO_OUTPUT_PATH_CANDIDATES,
};

export const kilo = defineAiTool(
  {
    toolId: "kilo",
    distributionProbes: { marketplace: ["kilo.json"] },
    directory: KILO_DIRECTORY,
    toolSuffix: TOOL_SUFFIX,
    displayName: "Kilo Code",
    signalDir: ".kilo/commands",
    configAssets: [
      {
        name: "kilo.json",
        content: kiloJson,
        destination: ".kilo/kilo.jsonc",
        delivery: "install",
      },
    ],
    hooks,
    buildContracts: {
      flat: contract(buildKiloFlatContract, hooks, KILO_FLAT_LAYOUT, {
        agentMarkdown: { frontmatter: AGENT_FRONTMATTER },
        config: KILO_OUTPUT_PATH_CANDIDATES,
      }),
    },

    capabilities: {
      agents: {
        format: "markdown",
        frontmatter: AGENT_FRONTMATTER,
      },
      skills: {},
      commands: {
        buildInstallPath: aiddCommandsUnder(KILO_DIRECTORY),
        convertFrontmatter: convertCommandFrontmatterNoHint,
      },
      rules: {
        buildInstallPath: installUnder(KILO_DIRECTORY, TOOL_SUFFIX, "rules/"),
        convertFrontmatter: descriptionOnlyRule,
      },
      mcp: { config: MCP_CONFIG },
      hooks: { delivery: hooksDelivery },
      layout: flatPlacement({
        artifacts: KILO_FLAT_LAYOUT,
        namespacePrefix: "aidd-",
        globalFiles: {
          dir: "{home}/.config/kilo",
          map: flatGlobalFilePath(KILO_DIRECTORY),
        },
      }),
      models: new ModelsSection({
        providers: ["openai", "anthropic", "mistral"],
        providerPrefix: true,
      }),
    },

    linkSyntax: [
      {
        from: /(@?)\.kilo\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
        to: "$1.kilo/commands/aidd/$2/$3",
      },
    ],
  },
  { json: new JsoncWriter() }
);
