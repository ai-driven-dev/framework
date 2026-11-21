import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../shared/domain/plugin/plugin-translation-skip.js";
import type { ReadonlyNoticeList } from "../../tools/contract/plugin-install-notice.js";
import { translate } from "../domain/engine.js";
import type { OutputFile } from "../domain/output-file.js";
import type { DistributionProbe } from "../domain/plugin-format.js";
import type { TranslateProfile } from "../domain/translate-profile.js";

export interface TranslateDistributionCommand {
  readonly distribution: PluginDistribution;
  readonly tool: TranslateProfile;
}

export interface TranslateDistributionResult {
  readonly files: readonly OutputFile[];
  readonly componentPaths: ReadonlyMap<string, string>;
  readonly flatHookPaths: ReadonlySet<string>;
  readonly skipped: ReadonlySkipList;
  readonly notices: ReadonlyNoticeList;
}

export class TranslateDistribution {
  private readonly manifestPaths: readonly string[];

  constructor(manifestProbes: readonly DistributionProbe[]) {
    this.manifestPaths = manifestProbes.map((probe) => probe.relativePath);
  }

  execute({ distribution, tool }: TranslateDistributionCommand): TranslateDistributionResult {
    const { files, componentPaths, flatHookPaths, skipped, notices } = translate(distribution, {
      kind: "install",
      tool,
      manifestPaths: this.manifestPaths,
    });
    return { files, componentPaths, flatHookPaths, skipped, notices };
  }
}
