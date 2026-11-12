import { AI_TOOL_IDS, type AiToolId } from "../../../kernel/tool.js";
import type { FrameworkBuildMode, ToolProfile } from "../../tools/contract/tool-profile.js";

/** The tool a framework build produces for. An alias rather than its own union: every AI tool
 * is buildable, so a sixth tool is a sixth target by construction, and writing the members
 * again would only create a second list to keep in step. */
export type FrameworkBuildTarget = AiToolId;

export interface FrameworkBuildTargetMode {
  readonly target: FrameworkBuildTarget;
  readonly mode: FrameworkBuildMode;
}

const BUILD_MODES: readonly FrameworkBuildMode[] = ["marketplace", "flat"];

/** A tool supports a mode when its profile declares a build contract for it. Takes the profiles
 * explicitly so the rule can be probed with synthetic tools. Walks the kernel's tool order, never
 * the order the profiles come in. */
export function buildTargetModesOf(
  profiles: readonly ToolProfile[]
): readonly FrameworkBuildTargetMode[] {
  const pairs: FrameworkBuildTargetMode[] = [];
  for (const target of AI_TOOL_IDS) {
    const profile = profiles.find((candidate) => candidate.toolId === target);
    if (profile === undefined || profile.kind !== "ai") continue;
    for (const mode of BUILD_MODES) {
      if (profile.buildContract(mode) !== null) pairs.push({ target, mode });
    }
  }
  return pairs;
}

/** Every target with at least one supported build mode. */
export function supportedBuildTargets(
  profiles: readonly ToolProfile[]
): readonly FrameworkBuildTarget[] {
  return [...new Set(buildTargetModesOf(profiles).map((entry) => entry.target))];
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

/** Path to the source (Claude-format) plugin manifest inside each plugin directory. */
export const SOURCE_PLUGIN_MANIFEST_RELATIVE = ".claude-plugin/plugin.json";

/** Path to the source (Claude-format) marketplace catalog. */
export const SOURCE_MARKETPLACE_RELATIVE = ".claude-plugin/marketplace.json";

export const PLUGIN_HOOKS_RELATIVE = "hooks/hooks.json";
export const PLUGIN_MCP_RELATIVE = ".mcp.json";
export const PLUGIN_AGENT_INPUT_EXT = ".md";
export const PLUGIN_SKILL_ENTRY_FILE = "SKILL.md";

/** Subdirectory names a build warns about and skips. */
export const OUT_OF_SCOPE_PLUGIN_SECTIONS: readonly ["commands", "rules"] = ["commands", "rules"];
