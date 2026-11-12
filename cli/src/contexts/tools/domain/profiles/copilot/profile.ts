import { join } from "node:path";
import copilotVscodeSettings from "../../../../../../assets/configs/copilot/vscode-settings.json" with {
  type: "json",
};
import { GITKEEP_FILE } from "../../../../../kernel/file.js";
import { DOCS_DIR } from "../../../../../kernel/paths.js";
import { CONFIG_MCP } from "../../../contract/config-refs.js";
import { convertCommandFrontmatter } from "../../formats/command.js";
import { nativeHooksSupport } from "../../formats/hooks-descriptor.js";
import { sharedMarketplaceKey } from "../../marketplace-entry.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { AgentsSection } from "../../sections/agents-section.js";
import { CommandsSection } from "../../sections/commands-section.js";
import { ConfigSection } from "../../sections/config-section.js";
import { nativeLayout } from "../../sections/layout-section.js";
import { manifestSection } from "../../sections/manifest-section.js";
import { acceptedPluginMcp, McpConfigPart } from "../../sections/mcp-section.js";
import { RulesSection } from "../../sections/rules-section.js";
import { SkillsSection } from "../../sections/skills-section.js";
import { buildCopilotFlatContract, buildCopilotMarketplaceContract } from "./build.js";
import { copilotAgentFrontmatter } from "./copilot-agent.js";
import { COPILOT_WORKSPACE_DIR } from "./copilot-paths.js";
import { COPILOT_HOOKS } from "./hooks.js";

const PLUGIN_MCP = acceptedPluginMcp();

const DIRECTORY = COPILOT_WORKSPACE_DIR;
const TOOL_SUFFIX = ".copilot.md";
const VSCODE_SETTINGS_ASSET = "vscode-settings.json";
const VSCODE_SETTINGS_PATH = ".vscode/settings.json";

// Canon's framework-doc reference placeholders. Copilot is the only tool that rewrites
// content between the canonical form and its own workspace-relative paths, so these
// tokens live here rather than in a shared location nothing else reads.
const TOOLS_PLACEHOLDER = "{{TOOLS}}/";
const DOCS_PLACEHOLDER = "{{DOCS}}/";
const AT_TOOLS_PLACEHOLDER = "@{{TOOLS}}/";
const AT_DOCS_PLACEHOLDER = "@{{DOCS}}/";

const EXT_AGENT = ".agent.md";
const EXT_PROMPT = ".prompt.md";
const EXT_INSTRUCTIONS = ".instructions.md";

function escapedRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function flattenFileName(
  fileName: string,
  targetExt: string,
  options: { toolSuffix?: string; stripNumericPrefix?: boolean } = {}
): string {
  const parts = fileName.split("/");
  let baseName = parts[parts.length - 1];

  if (options.stripNumericPrefix) {
    baseName = baseName.replace(/^\d+[_-]/, "");
  }
  if (options.toolSuffix && baseName.endsWith(options.toolSuffix)) {
    baseName = `${baseName.slice(0, -options.toolSuffix.length)}.md`;
  }
  baseName = baseName.replaceAll("_", "-");

  const withExt = addTargetExtension(baseName, targetExt);

  if (parts.length === 1) {
    return withExt;
  }

  const prefix = buildPrefix(parts.slice(0, -1).join("/"));
  return `${prefix}-${withExt}`;
}

function buildPrefix(subPath: string): string {
  return subPath
    .split("/")
    .map((p) => p.replace(/^(\d+)[_-].*$/, "$1"))
    .join("-");
}

function addTargetExtension(baseName: string, targetExt: string): string {
  if (baseName.endsWith(targetExt)) return baseName;
  const withoutMd = baseName.endsWith(".md") ? baseName.slice(0, -3) : baseName;
  return `${withoutMd}${targetExt}`;
}

const agentsHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    const name = base.endsWith(".md") ? `${base.slice(0, -3)}${EXT_AGENT}` : base;
    return `${DIRECTORY}agents/${name}`;
  },
};

const commandsHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    const flat = flattenFileName(fileName, EXT_PROMPT);
    return `${DIRECTORY}prompts/${flat}`;
  },
};

const rulesHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    const flat = flattenFileName(fileName, EXT_INSTRUCTIONS, {
      toolSuffix: TOOL_SUFFIX,
      stripNumericPrefix: true,
    });
    return `${DIRECTORY}instructions/${flat}`;
  },
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    const { paths, globs } = fm;
    const patterns = Array.isArray(paths) ? paths : Array.isArray(globs) ? globs : null;
    if (patterns !== null && patterns.length > 0) return { applyTo: patterns.join(",") };
    if (fm.alwaysApply === false && fm.description !== undefined) {
      return { description: fm.description };
    }
    return {};
  },
};

const skillsHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    return `${DIRECTORY}skills/${fileName}`;
  },
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return fm;
  },
};

function resolveInstalledPath(path: string): string {
  if (path.startsWith("agents/")) {
    const subPath = path.slice("agents/".length);
    if (subPath === "" || subPath.endsWith("/")) return `${DIRECTORY}agents/${subPath}`;
    return agentsHandler.buildFilePath(subPath) ?? `${DIRECTORY}${path}`;
  }
  if (path.startsWith("commands/")) {
    const subPath = path.slice("commands/".length);
    if (subPath === "" || subPath.endsWith("/")) return `${DIRECTORY}prompts/${subPath}`;
    return commandsHandler.buildFilePath(subPath) ?? `${DIRECTORY}${path}`;
  }
  if (path.startsWith("rules/")) {
    const subPath = path.slice("rules/".length);
    if (subPath === "" || subPath.endsWith("/")) return `${DIRECTORY}instructions/${subPath}`;
    return rulesHandler.buildFilePath(subPath) ?? `${DIRECTORY}${path}`;
  }
  if (path.startsWith("skills/")) {
    const subPath = path.slice("skills/".length);
    if (subPath === "" || subPath.endsWith("/")) return `${DIRECTORY}skills/${subPath}`;
    return skillsHandler.buildFilePath(subPath) ?? `${DIRECTORY}${path}`;
  }
  // Unknown section: a predictable directory-prefixed default rather than a silently dropped
  // reference when a new section is added to the framework.
  return `${DIRECTORY}${path}`;
}

function rewriteCopilotContent(content: string): string {
  return (
    content
      .replace(
        new RegExp(`${escapedRegex(AT_TOOLS_PLACEHOLDER)}([^\\s\`'">,]+)`, "g"),
        (_match, path: string) => {
          const fullPath = resolveInstalledPath(path);
          return `[${fullPath}](../../${fullPath})`;
        }
      )
      .replace(
        new RegExp(`${escapedRegex(AT_DOCS_PLACEHOLDER)}([^\\s\`'">,]+)`, "g"),
        (_match, path: string) => {
          return `[${DOCS_DIR}/${path}](../../${DOCS_DIR}/${path})`;
        }
      )
      // {{TOOLS}}/ (without @) replaces directory prefix only — used for path references in frontmatter or prose.
      // @{{TOOLS}}/ (with @) resolves to a full installed path via resolveInstalledPath — used for @-include syntax.
      .replaceAll("{{TOOLS}}/agents/", `${DIRECTORY}agents/`)
      .replace(/\{\{TOOLS\}\}\/commands\/([^\s\n`'">,]+)/g, (_match, path: string) => {
        const flat = flattenFileName(path, EXT_PROMPT);
        return `${DIRECTORY}prompts/${flat}`;
      })
      .replaceAll("{{TOOLS}}/rules/", `${DIRECTORY}instructions/`)
      .replaceAll("{{TOOLS}}/skills/", `${DIRECTORY}skills/`)
      .replaceAll(TOOLS_PLACEHOLDER, DIRECTORY)
      .replaceAll(DOCS_PLACEHOLDER, `${DOCS_DIR}/`)
  );
}

const hooksSupport = nativeHooksSupport(COPILOT_HOOKS);

export const copilot = defineAiTool({
  toolId: "copilot",
  distributionProbes: {
    manifest: [".plugin/plugin.json", ".github/plugin/plugin.json", "plugin.json"],
    // `.github/plugin/plugin.json` is the manifest's own second-choice location, never a
    // marketplace catalog: a real build leaves one at `.plugin/marketplace.json`.
    marketplace: [".plugin/marketplace.json"],
  },
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "GitHub Copilot",
  signalDir: ".github/prompts",
  configAssets: [
    {
      name: VSCODE_SETTINGS_ASSET,
      content: copilotVscodeSettings,
      destination: VSCODE_SETTINGS_PATH,
      delivery: "section",
    },
  ],
  buildContracts: {
    marketplace: buildCopilotMarketplaceContract,
    flat: buildCopilotFlatContract,
  },

  capabilities: () => ({
    agents: new AgentsSection({
      directory: DIRECTORY,
      toolSuffix: EXT_AGENT,
      format: "markdown",
      buildInstallPath: (fileName) => agentsHandler.buildFilePath(fileName),
      frontmatter: copilotAgentFrontmatter,
    }),
    skills: new SkillsSection({
      directory: DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      buildInstallPath: (fileName) => skillsHandler.buildFilePath(fileName),
      convertFrontmatter: (fm) => skillsHandler.convertFrontmatter(fm),
    }),
    commands: new CommandsSection({
      directory: DIRECTORY,
      toolSuffix: EXT_PROMPT,
      buildInstallPath: (fileName) => commandsHandler.buildFilePath(fileName),
      convertFrontmatter: (fm, relativeFileName) => convertCommandFrontmatter(fm, relativeFileName),
    }),
    rules: new RulesSection({
      directory: DIRECTORY,
      toolSuffix: EXT_INSTRUCTIONS,
      inputSuffix: TOOL_SUFFIX,
      buildInstallPath: (fileName) => rulesHandler.buildFilePath(fileName),
      convertFrontmatter: (fm) => rulesHandler.convertFrontmatter(fm),
    }),
    mcp: {
      config: new McpConfigPart({
        outputPath: ".vscode/mcp.json",
        format: "json",
        consumes: [CONFIG_MCP],
        transformContent: (content) => {
          const parsed = JSON.parse(content) as Record<string, unknown>;
          if ("mcpServers" in parsed && !("servers" in parsed)) {
            const { mcpServers, ...rest } = parsed as { mcpServers: unknown } & Record<
              string,
              unknown
            >;
            return JSON.stringify({ ...rest, servers: mcpServers }, null, 2);
          }
          return content;
        },
      }),
      plugin: PLUGIN_MCP,
    },
    config: [
      new ConfigSection({
        outputPath: VSCODE_SETTINGS_PATH,
        mergeStrategy: "framework-prime",
        staticContentAssetFile: VSCODE_SETTINGS_ASSET,
        requiresTool: "vscode",
      }),
    ],
    hooks: { delivery: hooksSupport.delivery },
    layout: nativeLayout({
      pluginsDir: ".github/plugins/",
      // Copilot auto-installs repo-level enabledPlugins; a foreign catalogue at the same name
      // must therefore never receive a declarative true entry before native source proof.
      // Its registry is global to the user and keyed by name, so a name held by a project that
      // no longer exists breaks every other project's installs — measured; `update` exits 1 on a
      // local path that is gone and 0 otherwise, which is what lets a dead name be reclaimed with
      // `--force` without ever taking one that still resolves.
      nativeActivation: {
        binary: "copilot",
        upgradeVerb: "update",
        updateVerb: "update",
        enableVerb: "install",
        disableVerb: "uninstall",
        sourceCheckVerb: "update",
        forceRemoveArgs: ["--force"],
        // Measured on 1.0.98: `plugin uninstall` sets the ref to `false` in enabledPlugins
        // rather than deleting it.
        uninstallLeavesRefDisabled: true,
        // Where `copilot plugin marketplace add`/`install` land, measured against the real
        // binary. Never written by aidd; named here for a diagnostic alone.
        userSettingsPath: (h) => join(h, ".copilot", "settings.json"),
        // Copilot's registry is `settings.json`, never `config.json`, whose `installedPlugins`
        // reads empty on a machine that has run installs.
        pluginRegistry: {
          location: (h) => join(h, ".copilot", "settings.json"),
          layout: "enabled-plugins-map",
        },
        // 1.0.98 answers `--json`; the installed 1.0.83 rejects it and stays unreadable.
        marketplaceSources: {
          from: "list-command",
          args: ["plugin", "marketplace", "list", "--json"],
          layout: "name-source-rows",
          hostLabel: "Copilot",
          unavailableMessage:
            "Copilot CLI marketplace list --json unavailable; upgrade to a supported binary and retry",
          unverifiedMessage:
            "Copilot CLI marketplace list --json output shape is not verified; upgrade to a supported binary and reconcile manually",
        },
      },
      // Copilot CLI and cloud agent read this repository file; enabledPlugins auto-installs.
      // Keep machine-local marketplace paths out and project only proven native refs.
      marketplaceSettings: {
        settingsPath: ".github/copilot/settings.json",
        settingsKey: "extraKnownMarketplaces",
        marketplacesSettingsPath: null,
        enabledPluginsKey: "enabledPlugins",
        declarativePluginActivationRequiresNativeProof: true,
        toEntryKey: sharedMarketplaceKey,
      },
    }),
    manifest: manifestSection({
      manifestRelativePath: "plugin.json",
      pluginRootToken: hooksSupport.rootToken,
      translationMode: "marketplace",
    }),
  }),

  rewriteContent: rewriteCopilotContent,
});
