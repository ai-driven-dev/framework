import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { ReadonlyNoticeList } from "../../../tools/contract/plugin-install-notice.js";
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
}

/** A plugin's distribution turned into the files one tool installs. */
export interface PluginTranslation {
  execute(command: PluginTranslationCommand): PluginTranslationResult;
}
