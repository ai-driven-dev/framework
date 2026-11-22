import { join } from "node:path";
import codexConfigToml from "../../../../../../assets/configs/codex/config.toml";
// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-codex.cjs";
import { MCP_CONFIG_REF } from "../../../contract/config-refs.js";
import type { LinkSyntax } from "../../../contract/link-syntax.js";
import { PLUGIN_ROOT_TOKEN } from "../../../contract/plugin-root-token.js";
import type { ShippedConfig } from "../../../contract/tool-profile.js";
import { buildAiddCommandFilePath, convertCommandFrontmatter } from "../../formats/command.js";
import { declareHooks } from "../../formats/hooks/declaration.js";
import { hooksConfigPart, nativeHooksSupport } from "../../formats/hooks/routes.js";
import type { TomlCodec } from "../../formats/toml.js";
import { tomlAgentFrontmatter, tomlAgentToml } from "../../formats/toml-agent.js";
import { defineAiTool } from "../../profile/define-tool.js";
import type { BoundTool } from "../../profile/tool-spec.js";
import { nativeLayout } from "../../sections/layout-section.js";
import { manifestSection } from "../../sections/manifest-section.js";
import { acceptedPluginMcp, McpConfigPart } from "../../sections/mcp-section.js";
import { ModelsSection } from "../../sections/models-section.js";
import { buildCodexContract, buildCodexFlatContract } from "./codex-build.model.js";
import { mergeCodexConfigToml } from "./codex-config.model.js";
import { codexGlobalFilePath } from "./codex-paths.model.js";

const PLUGIN_MCP = acceptedPluginMcp();

const DIRECTORY = ".codex/";
const TOOL_SUFFIX = ".codex.md";

const LINK_SYNTAX: LinkSyntax = [
  { from: /\.codex\/skills\//g, to: ".agents/skills/aidd-" },
  { from: /(@?)\.codex\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g, to: "$1.codex/commands/aidd/$2/$3" },
];

const hooks = declareHooks(
  { toolId: "codex", directory: DIRECTORY, adapter },
  {
    // Measured: four consecutive `codex exec` sessions installed a plugin's hooks and ran none of
    // them, with no warning, until `--dangerously-bypass-hook-trust` made the same install run
    // all three. Codex writes one `trusted_hash` per hook under `[hooks.state]` when a person
    // approves it; a hook with no entry is skipped in silence, and nothing prompts outside a
    // terminal.
    trustNotice:
      "Codex will not run this plugin's hooks until each one is trusted — approve the prompt " +
      "once in an interactive session, or pass --dangerously-bypass-hook-trust to codex exec " +
      "for a headless run. Until then, none of its hooks run and nothing says why.",
    // Each item kept whole: Codex trusts a hook by its whole entry, and an entry stripped of
    // `async` runs in the way of the session it was written to stay out of.
    file: { wrapper: {}, entries: { shape: "matchers", itemsKept: "commands" } },
    // The variable Codex expands to an installed plugin's directory in a hooks file.
    rootToken: PLUGIN_ROOT_TOKEN,
    flat: { scriptsDir: ".codex/hooks/", sharedFile: ".codex/hooks.json" },
    config: {
      outputPath: ".codex/hooks.json",
      mergeStrategy: "user-prime",
      consumes: ["codex-hooks"],
    },
  }
);

const hooksSupport = nativeHooksSupport(hooks);

const CODEX_CONFIG_ASSETS: readonly ShippedConfig[] = [
  {
    name: "config.toml",
    content: codexConfigToml,
    destination: ".codex/config.toml",
    delivery: "install",
  },
];

const CODEX_LAYOUT = nativeLayout({
  pluginsDir: ".codex/plugins/",
  globalFiles: { dir: (homedir) => join(homedir, ".codex"), map: codexGlobalFilePath },
  // Codex only enables plugins from its user-global config plus its own plugin cache; a
  // project-local settings file is inert, so the `codex` CLI is driven directly instead.
  nativeActivation: {
    binary: "codex",
    upgradeVerb: "upgrade",
    enableVerb: "add",
    disableVerb: "remove",
    // Codex's own `plugin remove` deletes a marketplace's cached content but leaves the
    // now-empty `cache/<hostName>/` shell behind. No `marketplaceRegistry` is declared -
    // codex refuses a re-add from a different source itself, so there is no registry to
    // reread: which is why `clean` proves this leftover safe to remove by its own
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
    // `$CODEX_HOME/config.toml` when set: a real codex binary reads there whatever `HOME`
    // says: else `~/.codex/config.toml`. Never written by aidd; named for a diagnostic alone.
    userSettingsPath: (h, env) => join(env("CODEX_HOME") || join(h, ".codex"), "config.toml"),
  },
});

function codexCapabilities(toml: TomlCodec) {
  return (bound: BoundTool) => ({
    agents: bound.agents({
      format: "toml",
      frontmatter: tomlAgentFrontmatter,
      serialize: tomlAgentToml(toml),
    }),
    skills: bound.skills({
      agentsSkillsDirectory: true,
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
        toml,
        mergeFn: mergeCodexConfigToml(toml),
        consumes: [MCP_CONFIG_REF],
      }),
      plugin: PLUGIN_MCP,
    },
    hooks: { config: hooksConfigPart(hooks), delivery: hooksSupport.delivery },
    layout: CODEX_LAYOUT,
    manifest: manifestSection({
      manifestRelativePath: "plugin.json",
      pluginRootToken: hooksSupport.rootToken,
    }),
    models: new ModelsSection({ providers: ["openai"] }),
  });
}

/** The Codex profile, writing its TOML files through `toml`. */
export const codexProfile = (toml: TomlCodec) =>
  defineAiTool({
    toolId: "codex",
    distributionProbes: {
      manifest: [".codex-plugin/plugin.json"],
      marketplace: [".agents/plugins/marketplace.json"],
    },
    directory: DIRECTORY,
    toolSuffix: TOOL_SUFFIX,
    displayName: "Codex",
    recommendedFor: (project) => project?.stack === "python" && !project.isMonorepo,
    signalDir: `${DIRECTORY}commands`,
    configAssets: CODEX_CONFIG_ASSETS,
    hooks,
    buildContracts: {
      marketplace: () => buildCodexContract(toml, hooks),
      flat: () => buildCodexFlatContract(toml, hooks),
    },

    capabilities: codexCapabilities(toml),

    linkSyntax: LINK_SYNTAX,
  });
