import type { ToolBuildContract } from "../../../src/contexts/tools/contract/build-contract.js";
import type { FrameworkBuildMode } from "../../../src/contexts/tools/contract/tool-profile.js";
import { translate } from "../../../src/contexts/translate/domain/engine.js";
import type { OutputFile } from "../../../src/contexts/translate/domain/output-file.js";
import type { PluginDistribution } from "../../../src/shared/domain/plugin/plugin-distribution.js";

/** The files the engine builds for one plugin in the given layout, named from the output
 * directory. */
export function translateBuildLayout(
  canon: PluginDistribution,
  contract: ToolBuildContract,
  mode: FrameworkBuildMode
): OutputFile[] {
  return translate(canon, { kind: "build", contract, mode, outDir: "/out" }).files;
}
