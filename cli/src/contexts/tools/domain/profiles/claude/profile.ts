import { join } from "node:path";
import { CONFIG_MCP } from "../../../contract/config-refs.js";
import { convertCommandFrontmatter } from "../../formats/command.js";
import { nativeHooksSupport } from "../../formats/hooks-descriptor.js";
import { claudeStyleMarketplaceKey } from "../../marketplace-entry.js";
import { nativeHooksParams } from "../../plugins/plugin-params.js";
import { pluginsCapability } from "../../plugins/plugins-capability.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { McpSection } from "../../sections/mcp-section.js";
import { buildClaudeContract, buildClaudeFlatContract } from "./build.js";
import { claudeAgentFrontmatter } from "./claude-agent.js";
import { CLAUDE_DIRECTORY } from "./claude-build-paths.js";
import { CLAUDE_HOOKS } from "./hooks.js";

const DIRECTORY = CLAUDE_DIRECTORY;
const TOOL_SUFFIX = ".claude.md";

function commandsDir(phase: string): string {
  return `${DIRECTORY}commands/aidd/${phase}/`;
}

const hooksSupport = nativeHooksSupport(CLAUDE_HOOKS);

export const claude = defineAiTool({
  toolId: "claude",
  distributionProbes: {
    manifest: [".claude-plugin/plugin.json"],
    marketplace: [".claude-plugin/marketplace.json"],
  },
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Claude Code",
  signalDir: ".claude/commands",
  configOutputPaths: { "settings.json": ".claude/settings.json" },
  buildContracts: { marketplace: buildClaudeContract, flat: buildClaudeFlatContract },

  capabilities: (bound) => ({
    agents: bound.agents({
      format: "markdown",
      frontmatter: claudeAgentFrontmatter,
    }),
    skills: bound.skills({
      buildInstallPath: bound.installUnder("skills/"),
      convertFrontmatter: (fm) => fm,
    }),
    commands: bound.commands({
      buildInstallPath: (fileName) => {
        const slashIdx = fileName.indexOf("/");
        if (slashIdx !== -1) {
          const phaseDir = fileName.slice(0, slashIdx);
          const rest = fileName.slice(slashIdx + 1);
          const phase = phaseDir.match(/^(\d+)/)?.[1];
          if (phase) return `${commandsDir(phase)}${rest}`;
        }
        return bound.installUnder("commands/")(fileName);
      },
      convertFrontmatter: (fm, relativeFileName) => convertCommandFrontmatter(fm, relativeFileName),
    }),
    rules: bound.rules({
      buildInstallPath: bound.installUnder("rules/"),
      convertFrontmatter: (fm) => {
        if ("paths" in fm) {
          const paths = fm.paths;
          if (Array.isArray(paths) && paths.length === 0) return {};
          return { paths };
        }
        if ("globs" in fm) return { paths: fm.globs };
        if ("alwaysApply" in fm) {
          if (fm.alwaysApply === false && fm.description !== undefined) {
            return { description: fm.description };
          }
          return {};
        }
        return {};
      },
    }),
    mcp: new McpSection({
      outputPath: ".mcp.json",
      format: "json",
      consumes: [CONFIG_MCP],
    }),
    hooks: { delivery: hooksSupport.delivery },
    plugins: pluginsCapability({
      mode: "native",
      pluginsDir: ".claude/plugins/",
      pluginManifestRelativePath: "plugin.json",
      ...nativeHooksParams(hooksSupport.delivery),
      pluginRootToken: hooksSupport.rootToken,
      acceptsMcp: true,
      translationMode: "marketplace",
      // Claude registers its own marketplaces and enables its own plugins, both driven here.
      // At project scope the command rewrites `.claude/settings.json` after this CLI hashed
      // it — two writers, one recorder, and `status` reporting drift forever. `--scope local`
      // writes `.claude/settings.local.json` instead, a file this CLI neither writes nor
      // tracks, which is what makes the verbs below safe to declare.
      nativeActivation: {
        binary: "claude",
        scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
        userRemoveArgs: [],
        enableVerb: "install",
        disableVerb: "uninstall",
        upgradeVerb: "update",
        // `--yes` gates a prune confirmation these calls never request, but a headless
        // stdin has no terminal to answer any prompt at all.
        pluginArgs: ["--yes"],
        // Root of claude's own marketplace registry, read by the sync guard that refuses a
        // name-stealing re-add before driving `marketplace add` at all. Declared here alone,
        // which is what keeps that guard claude-only by declaration.
        marketplaceRegistry: {
          location: (h) => join(h, ".claude", "plugins", "known_marketplaces.json"),
          layout: "install-locations-by-name",
        },
        marketplaceSources: { from: "marketplace-registry" },
        // Claude's own plugin registry, read by `doctor`: one entry per scope a ref was
        // installed at, an entry installed at a project scope also naming its project.
        pluginRegistry: {
          location: (h) => join(h, ".claude", "plugins", "installed_plugins.json"),
          layout: "plugin-entries-by-scope",
        },
        // Root of claude's own plugin cache. `clean` composes `<root>/<hostName>` and purges
        // only once a fresh read of `marketplaceRegistry` above no longer names it — claude
        // marks an orphaned tree `.orphaned_at` but never deletes it itself.
        pluginCacheDir: (h) => join(h, ".claude", "plugins", "cache"),
        // Where a `--scope user` install or marketplace add lands, measured against the real
        // binary. Never written by aidd; named here for a diagnostic alone.
        userSettingsPath: (h) => join(h, ".claude", "settings.json"),
      },
      marketplaceSettings: {
        settingsPath: ".claude/settings.json",
        settingsKey: "extraKnownMarketplaces",
        // The registered marketplace is the tree this CLI builds under `.aidd/cache/`, named
        // by absolute path, so the entry describes one machine and must not be committed. It
        // is the file `claude plugin marketplace add --scope local` writes itself.
        marketplacesSettingsPath: ".claude/settings.local.json",
        enabledPluginsKey: "enabledPlugins",
        toEntryKey: claudeStyleMarketplaceKey,
      },
    }),
  }),

  rewriteContent(content: string): string {
    return content.replace(
      /(@?)\.claude\/commands\/(\d+)[_][^/]+\//g,
      (_, at, phase) => `${at}${commandsDir(phase)}`
    );
  },
});
