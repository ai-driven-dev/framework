import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../shared/domain/plugin/plugin-translation-skip.js";
import type { ReadonlyNoticeList } from "../../tools/contract/plugin-install-notice.js";
import type { ToolProfile } from "../../tools/contract/tool-profile.js";
import type { OutputFile } from "./output-file.js";

export interface TranslateDistributionCommand {
  readonly distribution: PluginDistribution;
  readonly tool: ToolProfile;
}

export interface TranslateDistributionResult {
  readonly files: readonly OutputFile[];
  readonly componentPaths: ReadonlyMap<string, string>;
  readonly flatHookPaths: ReadonlySet<string>;
  readonly skipped: ReadonlySkipList;
  readonly notices: ReadonlyNoticeList;
}

export interface TranslateDistribution {
  execute(command: TranslateDistributionCommand): TranslateDistributionResult;
}
