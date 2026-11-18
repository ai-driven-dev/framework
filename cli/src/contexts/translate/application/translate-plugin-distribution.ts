import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../shared/domain/plugin/plugin-translation-skip.js";
import type { ReadonlyNoticeList } from "../../tools/contract/plugin-install-notice.js";
import type { ToolProfile } from "../../tools/contract/tool-profile.js";
import { PluginContentEngine } from "../domain/engine.js";
import type { OutputFile } from "../domain/output-file.js";
import type { DistributionProbe } from "../domain/plugin-format.js";

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

export class TranslatePluginDistribution {
  private readonly engine: PluginContentEngine;

  constructor(manifestProbes: readonly DistributionProbe[]) {
    this.engine = new PluginContentEngine(manifestProbes.map((probe) => probe.relativePath));
  }

  execute({ distribution, tool }: TranslateDistributionCommand): TranslateDistributionResult {
    return {
      ...this.engine.translateWithComponentPaths(distribution, tool),
      flatHookPaths: this.engine.flatHookPaths(distribution, tool),
    };
  }
}
