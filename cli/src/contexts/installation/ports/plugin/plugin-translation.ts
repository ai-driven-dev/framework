import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { ReadonlyNoticeList } from "../../../tools/contract/plugin-install-notice.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { ToolProfile } from "../../../tools/contract/tool-profile.js";

export interface PluginTranslationCommand {
  readonly distribution: PluginDistribution;
  readonly tool: ToolProfile;
}

/** A file the translation produces: where it lands and what it holds. Hashing is this context's. */
export interface TranslatedFile {
  readonly relativePath: string;
  readonly content: string;
}

export interface PluginTranslationResult {
  readonly files: readonly TranslatedFile[];
  readonly componentPaths: ReadonlyMap<string, string>;
  readonly flatHookPaths: ReadonlySet<string>;
  readonly skipped: ReadonlySkipList;
  readonly notices: ReadonlyNoticeList;
  /** The plugin's MCP servers in the shape the tool's own config holds, for the install to merge. */
  readonly installedMcp: string | null;
  /** The plugin's hooks for a tool that keeps them in the project: the manifest to merge into the
   * project's hooks file and the scripts to place beside it, each as the tool takes them. */
  readonly projectHooks: {
    readonly manifest: string | null;
    readonly scripts: readonly TranslatedFile[];
  };
}

/** A plugin's distribution turned into the files one tool installs. */
export interface PluginTranslation {
  execute(command: PluginTranslationCommand): PluginTranslationResult;
}
