import { join } from "node:path";
import { OpencodeDualConfigError } from "../../../../../kernel/errors.js";
import { CONFIG_MCP, CONFIG_OPENCODE } from "../../capabilities/config-refs.js";
import { McpCapability } from "../../capabilities/mcp-capability.js";
import {
  buildAiddCommandFilePath,
  convertCommandFrontmatterNoHint,
} from "../../formats/command.js";
import { flatHooksSupport } from "../../formats/hooks-descriptor.js";
import { toTypedMcpSection } from "../../formats/opencode-mcp-merge.js";
import { pluginsCapability } from "../../plugins/plugins-capability.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { buildOpencodeFlatContract } from "./build.js";
import { OPENCODE_HOOKS } from "./hooks.js";
import { opencodeAgentFrontmatter } from "./opencode-agent.js";
import { generateOpencodeHooksBridge } from "./opencode-hooks-bridge.js";
import { OPENCODE_DIRECTORY, opencodeGlobalFilePath } from "./opencode-paths.js";

const DIRECTORY = OPENCODE_DIRECTORY;
const TOOL_SUFFIX = ".opencode.md";

export const opencode = defineAiTool({
  toolId: "opencode",
  distributionProbes: {
    marketplace: ["opencode.json"],
  },
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "OpenCode",
  signalDir: ".opencode/commands",
  configOutputPaths: { "opencode.json": "opencode.json" },
  pluginRuntimeFiles: { [OPENCODE_HOOKS.bridgeRuntime.asset]: OPENCODE_HOOKS.bridgeRuntime.path },
  buildContracts: { flat: buildOpencodeFlatContract },

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
    mcp: new McpCapability({
      outputPath: "opencode.json",
      format: "json",
      entrySection: "mcp",
      mergeStrategy: "framework-prime",
      transformContent: toTypedMcpSection,
      consumes: [CONFIG_MCP, CONFIG_OPENCODE],
      outputPathCandidates: {
        tiers: [["opencode.json", "opencode.jsonc"]],
        fallback: "opencode.json",
        conflict: () => {
          throw new OpencodeDualConfigError();
        },
      },
    }),
    // Flat mode has no `marketplaceSettings` field, and opencode's `plugin[]` array accepts
    // only npm package names — no source or version a marketplace entry could express.
    plugins: pluginsCapability({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      globalFiles: {
        dir: (homedir) => join(homedir, ".config", "opencode"),
        map: opencodeGlobalFilePath,
      },
      ...flatHooksSupport(OPENCODE_HOOKS, generateOpencodeHooksBridge),
    }),
  }),

  rewriteContent(content: string): string {
    return content.replace(
      /(@?)\.opencode\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
      "$1.opencode/commands/aidd/$2/$3"
    );
  },
});
