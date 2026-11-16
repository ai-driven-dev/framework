import type { DistributionProbe } from "../contract/plugin-format.js";
import type {
  TranslateDistribution,
  TranslateDistributionCommand,
  TranslateDistributionResult,
} from "../contract/translate-distribution.js";
import { PluginContentEngine } from "../domain/engine.js";

export class TranslatePluginDistribution implements TranslateDistribution {
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
