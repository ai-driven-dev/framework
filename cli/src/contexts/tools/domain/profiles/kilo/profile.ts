import { join } from "node:path";
import { CONFIG_MCP } from "../../../contract/config-refs.js";
import {
  buildAiddCommandFilePath,
  convertCommandFrontmatterNoHint,
} from "../../formats/command.js";
import { flatHooksSupport } from "../../formats/hooks-descriptor.js";
import { toTypedMcpSection } from "../../formats/opencode-mcp-merge.js";
import { flatGlobalFilePath } from "../../plugins/plugin-params.js";
import { pluginsCapability } from "../../plugins/plugins-capability.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { McpSection } from "../../sections/mcp-section.js";
import { buildKiloFlatContract } from "./build.js";
import { KILO_HOOKS } from "./hooks.js";
import { kiloAgentFrontmatter } from "./kilo-agent.js";
import { generateKiloHooksBridge } from "./kilo-hooks-bridge.js";
import { KILO_DIRECTORY, KILO_OUTPUT_PATH_CANDIDATES } from "./kilo-paths.js";

const TOOL_SUFFIX = ".kilo.md";

export const kilo = defineAiTool({
  toolId: "kilo",
  distributionProbes: { marketplace: ["kilo.json"] },
  directory: KILO_DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Kilo Code",
  signalDir: ".kilo/commands",
  configOutputPaths: { "kilo.json": ".kilo/kilo.jsonc" },
  buildContracts: { flat: buildKiloFlatContract },

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
    mcp: new McpSection({
      outputPath: "kilo.json",
      format: "json",
      mergeStrategy: "framework-prime",
      transformContent: toTypedMcpSection,
      consumes: [CONFIG_MCP],
      outputPathCandidates: KILO_OUTPUT_PATH_CANDIDATES,
    }),
    plugins: pluginsCapability({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      globalFiles: {
        dir: (homedir) => join(homedir, ".config", "kilo"),
        map: flatGlobalFilePath(KILO_DIRECTORY),
      },
      ...flatHooksSupport(KILO_HOOKS, generateKiloHooksBridge),
    }),
  }),

  rewriteContent(content: string): string {
    return content.replace(
      /(@?)\.kilo\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
      "$1.kilo/commands/aidd/$2/$3"
    );
  },
});
