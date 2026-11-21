import type { ConfigAsset, SchemaName } from "../../../shared/domain/config-asset.js";

/** All a marketplace builder reads of the output tree. */
export interface BuildFileReader {
  readFile(path: string): Promise<string>;
}

/**
 * A generated event bridge, for a flat loader that scans no "hooks" family and reads no
 * hooks.json of its own. Both flat-materialization routes read it, so one plugin looks the
 * same whichever route installed it.
 */
export interface FlatHooksBridge {
  /** Raw (unrewritten) hooks.json content + plugin name -> the generated bridge module's
   * full text, or `null` when nothing in it named an event the bridge maps. */
  readonly generate: (rawHooksJson: string, plugin: string) => string | null;
  /** Output path for the generated bridge module, relative to the project root. */
  readonly path: (plugin: string) => string;
  /** A hooks/ file whose presence in this plugin's own source means it ships its own bridge
   * already: generate nothing for it. */
  readonly skipIfSourceHas: string;
}

/** How a plugin's artifact files are sourced: a sub-directory walked with an extension filter
 * or in full, a single plugin-relative file, or hooks.json plus its sibling scripts. */
export type ArtifactSource =
  | { readonly kind: "filteredTree"; readonly srcDir: string; readonly inputExt: string }
  | { readonly kind: "fullTree"; readonly srcDir: string }
  | { readonly kind: "configFile"; readonly srcPath: string }
  | { readonly kind: "hooksBundle"; readonly jsonPath: string; readonly scriptDir: string };

/** How a tool keeps an agent's markdown: the frontmatter it reads, from the agent's own and the
 * plugin and file it is built for. The engine reads and writes the file and resolves the links of
 * its body, the same for every tool. */
export interface AgentMarkdown {
  readonly frontmatter: (
    frontmatter: Record<string, unknown>,
    of: { readonly plugin: string; readonly outName: string }
  ) => Record<string, unknown>;
  /** The engine gives the agent the name its plugin and file make, `<plugin>-<file>`, in place of
   * the source's: for a layout that holds every plugin's agents in one place. */
  readonly pluginPrefixedName?: true;
  /** `double` for a reader that keeps single quotes literally. */
  readonly quote?: "double";
}

export type ArtifactContract =
  | { readonly supported: false }
  | {
      readonly supported: true;
      readonly source: ArtifactSource;
      readonly path: (plugin: string, relPath: string) => string;
      /** An agent's markdown, as the tool keeps it. Wins over `transform` for an agent. */
      readonly agentMarkdown?: AgentMarkdown;
      /** A skill entry's frontmatter, as the tool keeps it: absent, the entry is a byte-copy. */
      readonly skillFrontmatter?: (frontmatter: Record<string, unknown>) => Record<string, unknown>;
      /** Defaults to identity, a byte-copy. For an agent whose file is no markdown (Codex's
       * TOML), the whole conversion. */
      readonly transform?: (content: string, plugin: string, basename: string) => string;
      /** VS Code Copilot discovers a skill by its parent folder name, so flat mode rewrites
       * SKILL.md's `name` frontmatter to match. Meaningless outside a flat skill artifact. */
      readonly rewriteSkillName?: boolean;
      /** Additive merge into an existing config file, for a config-kind artifact that merges
       * rather than writing once per plugin. */
      readonly merge?: (
        existing: string | null,
        incomingPrefixed: Record<string, unknown>,
        force: boolean
      ) => { mergedContent: string; collisions: ReadonlyArray<string> };
      /** servers-key of the mcp merge target: `servers` for copilot, `mcpServers` for claude.
       * Only meaningful alongside `merge`. */
      readonly mcpServersKey?: string;
      /** Absolute path to the shared merge target; only for merge contracts. */
      readonly mergeDest?: (outDir: string) => string;
      /** The hooks file a plugin's hooks.json becomes: one every plugin shares, merged into,
       * or one of the plugin's own, written whole. Warnings are surfaced to the user. */
      readonly hooksFile?: {
        /** Relative to the output root. */
        readonly path: (plugin: string) => string;
        readonly shared: boolean;
        /** The existing file, `null` for a plugin's own, and the plugin's raw hooks.json;
         * `locate` names, in a command, a path the plugin ships outside `hooks/`. */
        readonly merge: (
          existing: string | null,
          shipped: ShippedHooks
        ) => { content: string; warnings: readonly string[] };
      };
      /** A hook script as the tool runs it, given its path in the plugin: the tool's own host
       * adapter replaces the one the plugin ships. Absent, every script is written as shipped. */
      readonly script?: (pluginPath: string, content: string) => string;
      /** Delivers everything under hooks/ except hooks.json, for a tool whose own side reads
       * none: OpenCode today, whose scripts are still delivered and whose trigger is
       * `hooksBridge`. */
      readonly skipHooksJson?: boolean;
      /** A generated event bridge, for a tool with no hooks.json of its own and no other way
       * to trigger a plugin's declared hooks. Read only when `skipHooksJson` is also true. */
      readonly hooksBridge?: FlatHooksBridge;
    };

/** An artifact a tool carries, as opposed to one it declares unsupported. */
export type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

export interface ToolBuildContract {
  /** Rewrites the source `${CLAUDE_PLUGIN_ROOT}` placeholder in hooks and mcp content: e.g.
   * `${CURSOR_PLUGIN_ROOT}`, `${PLUGIN_ROOT}`. Absent for a flat-only contract, which
   * substitutes nothing. */
  readonly pluginRootToken?: string;
  /** Plugin-manifest file relative to plugin tree root (e.g. ".claude-plugin/plugin.json"). null if no manifest. */
  readonly manifestFileRelative: string | null;

  /** Synthesize a tool-native plugin manifest from the source manifest + presence flags. null if tool has no manifest. */
  readonly synthesizeManifest:
    | ((source: Record<string, unknown>, presence: PluginPresence) => Record<string, unknown>)
    | null;

  readonly manifestSchemaName: SchemaName | null;

  readonly artifacts: {
    readonly skills: ArtifactContract;
    readonly agents: ArtifactContract;
    readonly mcp: ArtifactContract;
    readonly hooks: ArtifactContract;
    readonly rules: ArtifactContract;
    readonly commands: ArtifactContract;
  };

  /** The tool's own config file (Codex's config.toml, opencode.json), built once every plugin
   * is written. */
  readonly configArtifact?: ConfigArtifact;

  /** Builds the marketplace catalog once every plugin is written, to write and validate.
   * `null` where the tool has no marketplace. */
  readonly buildMarketplaceCatalog:
    | ((
        sourceMarketplace: SourceMarketplaceRef,
        pluginEntries: readonly Record<string, unknown>[],
        fs: BuildFileReader
      ) => Promise<{
        catalog: Record<string, unknown>;
        schemaName: SchemaName | null;
        destRelPath: string;
      }>)
    | null;

  readonly buildMarketplaceEntry:
    | ((entry: MarketplaceEntryInput) => Promise<Record<string, unknown>>)
    | null;
}

/** What a marketplace entry is built from: the plugin, as built under `outDir`, and the entry
 * the source marketplace holds for it. */
export interface MarketplaceEntryInput {
  readonly name: string;
  readonly pluginSrc: string;
  readonly outDir: string;
  readonly srcEntry: SourcePluginEntryRef | undefined;
  readonly fs: BuildFileReader;
}

/** A plugin's hooks as it ships them. `locate` names, in a command, a path the plugin ships
 * outside `hooks/`; left out, such a path stays as written. */
export interface ShippedHooks {
  readonly json: string;
  readonly plugin: string;
  readonly locate?: (pluginPath: string) => string;
}

/** A config file a tool builds from every plugin at once. The build reads what it names and
 * writes what `emit` returns, so the decision itself touches no disk. */
export interface ConfigArtifact {
  /** Files under the output root `emit` needs, read when they exist. */
  readonly reads: (builtPlugins: readonly string[]) => readonly string[];
  /** Files under the output root whose presence alone `emit` needs; never read. */
  readonly probes: (builtPlugins: readonly string[]) => readonly string[];
  /** The tool's bundled config assets `emit` builds on. */
  readonly assets: { readonly tool: string; readonly names: readonly string[] };
  readonly emit: (input: ConfigArtifactInput) => readonly ConfigArtifactFile[];
}

export interface ConfigArtifactInput {
  readonly builtPlugins: readonly string[];
  /** Each built plugin's own `.mcp.json`, by plugin, its server keys already prefixed with the
   * plugin's name; a plugin shipping none is absent. */
  readonly pluginMcp: ReadonlyMap<string, string>;
  /** Each file `reads` named that exists, by its path under the output root. */
  readonly existing: ReadonlyMap<string, string>;
  /** Each file `probes` named that exists, by its path under the output root. */
  readonly present: ReadonlySet<string>;
  /** Each asset `assets` named, by file name. */
  readonly assets: ReadonlyMap<string, ConfigAsset>;
}

export interface ConfigArtifactFile {
  /** Relative to the output root. */
  readonly path: string;
  readonly content: string;
}

/** Minimal reference to the source marketplace catalog, so `domain/` need not import the
 * application layer. */
export interface SourceMarketplaceRef {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly owner?: unknown;
  readonly plugins: readonly SourcePluginEntryRef[];
  readonly [key: string]: unknown;
}

export interface SourcePluginEntryRef {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly strict?: boolean;
  readonly metadata?: { readonly recommended?: boolean };
  readonly [key: string]: unknown;
}

export interface PluginPresence {
  readonly hasAgents: boolean;
  /** Agent markdown files relative to the plugin's `agents/` dir (e.g. "planner.md"), sorted. */
  readonly agentsList: readonly string[];
  readonly skillsList: readonly string[];
  readonly hasHooksJson: boolean;
  readonly hasMcpJson: boolean;
}
