import type {
  TranslateDistribution,
  TranslateDistributionCommand,
  TranslateDistributionResult,
} from "../contract/translate-distribution.js";
import { PluginContentEngine } from "../domain/engine.js";

export class TranslatePluginDistribution implements TranslateDistribution {
  private readonly engine = new PluginContentEngine();

  execute({ distribution, tool }: TranslateDistributionCommand): TranslateDistributionResult {
    return {
      ...this.engine.translateWithComponentPaths(distribution, tool),
      flatHookPaths: this.engine.flatHookPaths(distribution, tool),
    };
  }
}
