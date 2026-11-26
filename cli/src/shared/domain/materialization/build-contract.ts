import type { FrontmatterShape } from "../markdown.js";
import type { SourceMarketplaceRef, SourcePluginEntryRef } from "../plugin/source-refs.js";
import type { ConfigAsset, SchemaName } from "../reading/config-asset.js";
import type { FlatArtifactLayout, FlatHooksLoaderEntry } from "./flat-paths.js";

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
   * full text, `null` when nothing in it named an event the bridge maps, and what the bridge
   * leaves out of the hooks it was read from, one reason each, as an install names a skip: read
   * once, both told together. */
  readonly generate: (
    rawHooksJson: string,
    plugin: string
  ) => { readonly content: string | null; readonly warnings: readonly string[] };
  /** One of those reasons as a build warns it, under the tool it is reported for. */
  readonly warning: (reason: string) => string;
  /** The directory, relative to the project root, the generated bridge module lands in, named
   * `<plugin>-hooks.js`. */
  readonly dir: string;
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

/** How a tool keeps a rule's frontmatter: the keys it reads, from the rule's own. */
export type RuleMarkdown = Pick<FrontmatterShape, "frontmatter" | "quote">;

/** Where an artifact's files land, as data: a skills or agents layout, the path a file has in its
 * plugin, one shared file, or a hooks route. */
export type ArtifactPlacement =
  | {
      readonly kind: "layout";
      readonly layout: FlatArtifactLayout;
      readonly of: "skill" | "agent" | "rule";
    }
  | { readonly kind: "relative" }
  | { readonly kind: "file"; readonly at: string }
  | {
      readonly kind: "agentFiles";
      readonly dir: string;
      readonly ext: string;
      /** The host loads these from `dir`, outside the plugin's `agents/`, so an install stages them as the build does. */
      readonly staged?: true;
    }
  | {
      readonly kind: "hooks";
      readonly scriptsDir: string;
      readonly loaderEntry?: FlatHooksLoaderEntry;
    };

/** A plugin's hooks.json in a tool's own form, and what the conversion left out. */
export type ConvertHooks = (
  json: string,
  plugin: string
) => { content: string; warnings: readonly string[] };

export type ArtifactContract =
  | {
      readonly supported: false;
      /** Why the tool ships none: what a reader of the profile needs to know. */
      readonly reason: string;
    }
  | {
      readonly supported: true;
      readonly source: ArtifactSource;
      /** Where a file lands. */
      readonly placement: ArtifactPlacement;
      /** An agent's markdown, as the tool keeps it. Wins over `transform` for an agent. */
      readonly agentMarkdown?: AgentMarkdown;
      /** A skill entry's frontmatter, as the tool keeps it: absent, the entry is a byte-copy. */
      readonly skillFrontmatter?: (frontmatter: Record<string, unknown>) => Record<string, unknown>;
      /** A rule's markdown, as the tool keeps it for the scope it reads: absent, the rule is
       * carried as shipped. */
      readonly ruleMarkdown?: RuleMarkdown;
      /** Defaults to identity, a byte-copy. For an agent whose file is no markdown (Codex's
       * TOML), the whole conversion. */
      readonly transform?: (content: string, plugin: string, basename: string) => string;
      /** A plugin's hooks.json as a tool that reads it in a form of its own keeps it, with what
       * the conversion dropped. Its content is what `transform` gives. */
      readonly convertHooks?: ConvertHooks;
      /** VS Code Copilot discovers a skill by its parent folder name, so flat mode rewrites
       * SKILL.md's `name` frontmatter to match. Meaningless outside a flat skill artifact. */
      readonly rewriteSkillName?: boolean;
      /** Present for an mcp artifact every plugin's servers are merged into, one shared file at
       * `placement`: the property holding the server map, `servers` for VS Code, `mcpServers` for
       * Claude and Cursor. */
      readonly mcpServersKey?: string;
      /** The hooks file a plugin's hooks.json becomes: one every plugin shares, merged into,
       * or one of the plugin's own, written whole. Warnings are surfaced to the user. */
      readonly hooksFile?: {
        /** Relative to the output root: `shared`, the one file every plugin merges into, or
         * `own`, the directory of a file of the plugin's own, `<plugin>.hooks.json`. */
        readonly at: { readonly shared: string } | { readonly own: string };
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
    /** A tool that carries a plugin's rules as files. Absent, the build leaves rules out and says so. */
    readonly rules?: ArtifactContract;
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
  /** The glob listing each built plugin's rules, for a plugin that placed any. */
  readonly rulesGlobs: readonly string[];
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

export interface PluginPresence {
  readonly hasAgents: boolean;
  /** Agent markdown files relative to the plugin's `agents/` dir (e.g. "planner.md"), sorted. */
  readonly agentsList: readonly string[];
  readonly skillsList: readonly string[];
  readonly hasHooksJson: boolean;
  readonly hasMcpJson: boolean;
  /** The servers `.mcp.json` declares, by name, for a tool whose manifest carries them inline. */
  readonly mcpServers: Readonly<Record<string, unknown>>;
}
