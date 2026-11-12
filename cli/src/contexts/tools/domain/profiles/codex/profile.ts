import { join } from "node:path";
import { CONFIG_MCP } from "../../../contract/config-refs.js";
import { codexAgentFrontmatter, codexAgentToml } from "../../behaviours/codex-agent-toml.js";
import { buildAiddCommandFilePath, convertCommandFrontmatter } from "../../formats/command.js";
import { hooksConfigPart, nativeHooksSupport } from "../../formats/hooks-descriptor.js";
import { nativeHooksParams } from "../../plugins/plugin-params.js";
import { pluginsCapability } from "../../plugins/plugins-capability.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { acceptedPluginMcp, McpConfigPart } from "../../sections/mcp-section.js";
import {
  buildCodexContract,
  buildCodexFlatContract,
  mergeCodexConfigToml,
  stripCodexSkillFrontmatter,
} from "./build.js";
import { CODEX_DIRECTORY, codexGlobalFilePath } from "./codex-paths.js";
import { CODEX_HOOKS } from "./hooks.js";

const PLUGIN_MCP = acceptedPluginMcp();

const DIRECTORY = CODEX_DIRECTORY;
const TOOL_SUFFIX = ".codex.md";
const AGENTS_SKILLS_PREFIX = ".agents/skills/";

const SKILLS_TO_AGENTS_RE = /\.codex\/skills\//g;

function remapSkillPaths(content: string): string {
  return content.replace(SKILLS_TO_AGENTS_RE, ".agents/skills/aidd-");
}

export function rewriteCodexContent(content: string): string {
  return remapSkillPaths(content).replace(
    /(@?)\.codex\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
    "$1.codex/commands/aidd/$2/$3"
  );
}

function skillNameFromPath(fileName: string): string {
  const parts = fileName.split("/");
  if (parts.length > 1) return parts[0];
  const base = parts[0];
  if (base.endsWith(TOOL_SUFFIX)) return base.slice(0, -TOOL_SUFFIX.length);
  if (base.endsWith(".md")) return base.slice(0, -3);
  return base;
}

function buildCodexSkillFilePath(fileName: string): string {
  return `${AGENTS_SKILLS_PREFIX}aidd-${skillNameFromPath(fileName)}/SKILL.md`;
}

const hooksSupport = nativeHooksSupport(CODEX_HOOKS);

export const codex = defineAiTool({
  toolId: "codex",
  distributionProbes: {
    manifest: [".codex-plugin/plugin.json"],
    marketplace: [".agents/plugins/marketplace.json"],
  },
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Codex",
  signalDir: `${DIRECTORY}commands`,
  configOutputPaths: { "config.toml": ".codex/config.toml" },
  buildContracts: { marketplace: buildCodexContract, flat: buildCodexFlatContract },

  capabilities: (bound) => ({
    agents: bound.agents({
      format: "toml",
      frontmatter: codexAgentFrontmatter,
      serialize: codexAgentToml,
    }),
    skills: bound.skills({
      agentsSkillsDirectory: true,
      buildInstallPath: buildCodexSkillFilePath,
      convertFrontmatter: stripCodexSkillFrontmatter,
    }),
    commands: bound.commands({
      buildInstallPath: (fileName) => buildAiddCommandFilePath(DIRECTORY, fileName),
      convertFrontmatter: (fm, relativeFileName) => convertCommandFrontmatter(fm, relativeFileName),
    }),
    rules: bound.rules({
      buildInstallPath: bound.installUnder("rules/"),
      convertFrontmatter: (fm) => fm,
    }),
    mcp: {
      config: new McpConfigPart({
        outputPath: ".codex/config.toml",
        format: "toml",
        mergeFn: mergeCodexConfigToml,
        consumes: [CONFIG_MCP],
      }),
      plugin: PLUGIN_MCP,
    },
    hooks: { config: hooksConfigPart(CODEX_HOOKS), delivery: hooksSupport.delivery },
    plugins: pluginsCapability({
      mode: "native",
      pluginsDir: ".codex/plugins/",
      pluginManifestRelativePath: "plugin.json",
      globalFiles: { dir: (homedir) => join(homedir, ".codex"), map: codexGlobalFilePath },
      mcp: PLUGIN_MCP,
      translationMode: "marketplace",
      // Codex only enables plugins from its user-global config plus its own plugin cache; a
      // project-local settings file is inert, so the `codex` CLI is driven directly instead.
      ...nativeHooksParams(hooksSupport.delivery),
      pluginRootToken: hooksSupport.rootToken,
      nativeActivation: {
        binary: "codex",
        upgradeVerb: "upgrade",
        enableVerb: "add",
        disableVerb: "remove",
        // Codex's own `plugin remove` deletes a marketplace's cached content but leaves the
        // now-empty `cache/<hostName>/` shell behind. No `marketplaceRegistry` is declared —
        // codex refuses a re-add from a different source itself, so there is no registry to
        // reread — which is why `clean` proves this leftover safe to remove by its own
        // emptiness instead.
        pluginCacheDir: (h) => join(h, ".codex", "plugins", "cache"),
        // The registry is read from `~/.codex/config.toml` whatever `CODEX_HOME` says, unlike
        // `userSettingsPath` below: a measured behaviour kept as it is, not an oversight.
        pluginRegistry: {
          location: (h) => join(h, ".codex", "config.toml"),
          layout: "toml-plugin-tables",
        },
        marketplaceSources: {
          from: "list-command",
          args: ["plugin", "marketplace", "list", "--json"],
          layout: "marketplaces-with-source",
          hostLabel: "Codex",
          unavailableMessage:
            "Codex marketplace list --json unavailable; inspect the host CLI and retry",
          unverifiedMessage: "Codex marketplace list --json output shape is not verified",
        },
        // `$CODEX_HOME/config.toml` when set — a real codex binary reads there whatever `HOME`
        // says — else `~/.codex/config.toml`. Never written by aidd; named for a diagnostic alone.
        userSettingsPath: (h, env) => join(env("CODEX_HOME") || join(h, ".codex"), "config.toml"),
      },
    }),
  }),

  rewriteContent(content: string): string {
    return rewriteCodexContent(content);
  },
});
