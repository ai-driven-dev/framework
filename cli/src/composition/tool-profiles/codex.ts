import codexConfigToml from "../../../assets/configs/codex/config.toml";
// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../assets/hooks-runtime/host-codex.cjs";
import type {
  NativeActivationSpec,
  NativeRegistrationSection,
} from "../../contexts/host-registration/contract/native-registration-spec.js";
import { MCP_CONFIG_REF } from "../../contexts/tools/contract/config-refs.js";
import type { ShippedConfig } from "../../contexts/tools/contract/tool-profile.js";
import { buildCodexContract } from "../../contexts/tools/domain/behaviours/codex/codex-build.model.js";
import { mergeCodexConfigToml } from "../../contexts/tools/domain/behaviours/codex/codex-config.model.js";
import { buildCodexFlatContract } from "../../contexts/tools/domain/behaviours/codex/codex-flat-build.model.js";
import { codexGlobalFilePath } from "../../contexts/tools/domain/behaviours/codex/codex-paths.model.js";
import { tomlAgentFrontmatter } from "../../contexts/tools/domain/formats/agents/toml-agent.js";
import { declareHooks } from "../../contexts/tools/domain/formats/hooks/declaration.js";
import {
  hooksConfigPart,
  nativeHooksSupport,
} from "../../contexts/tools/domain/formats/hooks/routes.js";
import { PLUGIN_ROOT_TOKEN } from "../../contexts/tools/domain/formats/plugin-root-token.js";
import { tomlContract } from "../../contexts/tools/domain/profile/contract-builders.js";
import type {
  DeclaredSections,
  McpTomlDeclaration,
} from "../../contexts/tools/domain/profile/declared-sections.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { singlePythonRepo } from "../../contexts/tools/domain/profile/recommendation.js";
import type { AiToolSpec } from "../../contexts/tools/domain/profile/tool-spec.js";
import { nativeLayout } from "../../contexts/tools/domain/sections/layout-section.js";
import { manifestSection } from "../../contexts/tools/domain/sections/manifest-section.js";
import { acceptedPluginMcp } from "../../contexts/tools/domain/sections/mcp-section.js";
import { ModelsSection } from "../../contexts/tools/domain/sections/models-section.js";
import { SmolTomlCodec } from "../../contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";
import type { LinkSyntax } from "../../shared/domain/materialization/link-syntax.js";

const PLUGIN_MCP = acceptedPluginMcp();

const DIRECTORY = ".codex/";
const TOOL_SUFFIX = ".codex.md";

// Codex scans `.agents/skills/` (cwd to repo root) for workspace skills, the documented project
// skill root; verified live, a SKILL.md there appears in Codex's "Available skills" context.
// `.codex/skills/` also resolves but is undocumented, so the documented root is what is used.
const CODEX_FLAT: { readonly layout: FlatArtifactLayout; readonly configPath: string } = {
  layout: flatArtifactLayout(".codex/", {
    skillsDir: ".agents/skills/",
    skills: "single-level",
    agent: { ext: ".toml" },
  }),
  configPath: ".codex/config.toml",
};

const LINK_SYNTAX: LinkSyntax = [{ from: /\.codex\/skills\//g, to: ".agents/skills/aidd-" }];

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

// Codex only enables plugins from its user-global config plus its own plugin cache; a
// project-local settings file is inert, so the `codex` CLI is driven directly instead.
const CODEX_ACTIVATION: NativeActivationSpec = {
  binary: "codex",
  upgradeVerb: "upgrade",
  enableVerb: "add",
  disableVerb: "remove",
  // Codex's own `plugin remove` deletes a marketplace's cached content but leaves the
  // now-empty `cache/<hostName>/` shell behind. No `marketplaceRegistry` is declared -
  // codex refuses a re-add from a different source itself, so there is no registry to
  // reread: which is why `clean` proves this leftover safe to remove by its own
  // emptiness instead.
  pluginCacheDir: "{home}/.codex/plugins/cache",
  // The registry is read from `~/.codex/config.toml` whatever `CODEX_HOME` says, unlike
  // `userSettingsPath` below: a measured behaviour kept as it is, not an oversight.
  pluginRegistry: {
    location: "{home}/.codex/config.toml",
    layout: "toml-plugin-tables",
  },
  marketplaceSources: {
    from: "list-command",
    args: ["plugin", "marketplace", "list", "--json"],
    layout: "marketplaces-with-source",
    hostLabel: "Codex",
    unavailableMessage: "Codex marketplace list --json unavailable; inspect the host CLI and retry",
    unverifiedMessage: "Codex marketplace list --json output shape is not verified",
  },
  // `$CODEX_HOME/config.toml` when set: a real codex binary reads there whatever `HOME`
  // says: else `~/.codex/config.toml`. Never written by aidd; named for a diagnostic alone.
  userSettingsPath: { env: "CODEX_HOME", fallback: "{home}/.codex", fileName: "config.toml" },
};

const CODEX_LAYOUT = nativeLayout({
  pluginsDir: ".codex/plugins/",
  globalFiles: { dir: "{home}/.codex", map: codexGlobalFilePath },
});

/** The MCP servers file, merged as TOML with the codec the composition wires. */
const MCP_CONFIG: McpTomlDeclaration = {
  outputPath: ".codex/config.toml",
  format: "toml",
  mergeWith: mergeCodexConfigToml,
  consumes: [MCP_CONFIG_REF],
};

// No `rules` capability: Codex reads markdown guidance only from AGENTS.md, and
// `.codex/rules/` takes Starlark command policy (https://developers.openai.com/codex/rules).
const CODEX_CAPABILITIES = {
  agents: { format: "toml", frontmatter: tomlAgentFrontmatter },
  skills: { agentsSkillsDirectory: true },
  mcp: { config: MCP_CONFIG, plugin: PLUGIN_MCP },
  hooks: { config: hooksConfigPart(hooks), delivery: hooksSupport.delivery },
  layout: CODEX_LAYOUT,
  manifest: manifestSection({
    manifestRelativePath: ".codex-plugin/plugin.json",
    pluginRootToken: hooksSupport.rootToken,
  }),
  models: new ModelsSection({ providers: ["openai"] }),
} satisfies DeclaredSections;

/** The Codex declaration. Its agents and MCP file name the TOML format. */
export const codexSpec = {
  toolId: "codex",
  distributionProbes: {
    manifest: [".codex-plugin/plugin.json"],
    marketplace: [".agents/plugins/marketplace.json"],
  },
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Codex",
  recommendedFor: singlePythonRepo,
  signalDir: null,
  configAssets: CODEX_CONFIG_ASSETS,
  hooks,
  buildContracts: {
    marketplace: tomlContract(buildCodexContract, hooks),
    flat: tomlContract(buildCodexFlatContract, hooks, CODEX_FLAT),
  },

  capabilities: CODEX_CAPABILITIES,

  linkSyntax: LINK_SYNTAX,
} satisfies AiToolSpec<typeof CODEX_CAPABILITIES>;

/** Codex names the TOML format; its codec is the one adapter wired here. */
export const codex = defineAiTool(codexSpec, { toml: new SmolTomlCodec() });

/** The section host-registration reads: how Codex's own plugin CLI activates plugins. */
export const codexNativeRegistration: NativeRegistrationSection = { activation: CODEX_ACTIVATION };
