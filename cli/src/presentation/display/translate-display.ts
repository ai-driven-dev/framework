import type { FrameworkBuildMode } from "../../contexts/tools/contract/tool-profile.js";
import type { Output } from "../../orchestration/domain/output.js";

interface TranslateOutcome {
  readonly pluginCount: number;
  readonly totalFiles: number;
  readonly outDir: string;
}

export function printTranslateResult(
  output: Output,
  mode: FrameworkBuildMode,
  outcome: TranslateOutcome
): void {
  if (mode === "flat") {
    output.success(
      `Flat-installed ${outcome.pluginCount} plugins, ${outcome.totalFiles} files written under ${outcome.outDir}`
    );
    return;
  }
  output.success(
    `Built ${outcome.pluginCount} plugins, ${outcome.totalFiles} files written to ${outcome.outDir}`
  );
}
