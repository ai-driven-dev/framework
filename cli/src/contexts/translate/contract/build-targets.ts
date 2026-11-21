import type { AiToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import {
  FRAMEWORK_BUILD_MODES,
  type FrameworkBuildMode,
} from "../../tools/contract/tool-profile.js";

/** The tool a framework build produces for. An alias rather than its own union: every AI tool
 * is buildable, so a sixth tool is a sixth target by construction, and writing the members
 * again would only create a second list to keep in step. */
export type FrameworkBuildTarget = AiToolId;

export interface FrameworkBuildTargetMode {
  readonly target: FrameworkBuildTarget;
  readonly mode: FrameworkBuildMode;
}

/** A tool supports a mode when its profile declares a build contract for it. Takes the catalog
 * explicitly so the rule can be probed with synthetic tools. Walks the catalog's canonical order. */
export function buildTargetModesOf(tools: ToolCatalog): readonly FrameworkBuildTargetMode[] {
  const pairs: FrameworkBuildTargetMode[] = [];
  for (const target of tools.idsInCanonicalOrder("ai")) {
    const profile = tools.aiProfile(target);
    for (const mode of FRAMEWORK_BUILD_MODES) {
      if (profile.buildContract(mode) !== null) pairs.push({ target, mode });
    }
  }
  return pairs;
}

/** Every target with at least one supported build mode. */
export function supportedBuildTargets(tools: ToolCatalog): readonly FrameworkBuildTarget[] {
  return [...new Set(buildTargetModesOf(tools).map((entry) => entry.target))];
}

export interface FrameworkBuildOptions {
  readonly sourceDir: string;
  readonly outDir: string;
  readonly target: FrameworkBuildTarget;
  /** Output layout. Defaults to "marketplace" (Mode A) when absent. */
  readonly mode?: FrameworkBuildMode;
}

export interface BuildPluginResult {
  readonly name: string;
  readonly filesWritten: number;
  readonly skippedSections: readonly string[];
}

export interface FrameworkBuildResult {
  readonly outDir: string;
  readonly plugins: readonly BuildPluginResult[];
  readonly totalFiles: number;
}
