import type { FrameworkBuildMode } from "../../../../src/contexts/tools/contract/tool-profile.js";
import type { ToolBuildContract } from "../../../../src/shared/domain/materialization/build-contract.js";

/**
 * What a build writes that no single plugin's translation holds. Each step folds across plugins
 * or reads the output tree, so it stays in the sink and nowhere else: the engine hands the sink a
 * plugin's hooks and MCP servers, and the sink merges them into the file other plugins share.
 * Two more sink steps write no file, so they have no entry: `assertFlatDestinationFree`
 * (`sinks/flat-collision.ts`, called by `DiskSink`) and `DiskSink.prepare`.
 */
export const BUILD_ONLY_FOLDS = [
  "plugin manifest",
  "marketplace catalog",
  "flat hooks file",
  "flat MCP file",
  "flat config artifact",
];

interface BuildCell {
  readonly target: string;
  readonly mode: FrameworkBuildMode;
  readonly contract: ToolBuildContract;
}

const CATALOG: Record<string, string> = {
  copilot: ".plugin/marketplace.json",
  codex: ".agents/plugins/marketplace.json",
  claude: ".claude-plugin/marketplace.json",
  cursor: ".cursor-plugin/marketplace.json",
};

/** The flat files a cell folds into, by fold. A hooks file one plugin owns is no fold: the engine
 * writes it, so copilot lists none here. Written down, so a new one is a deliberate edit. */
const FLAT_FOLDS: Record<string, Record<string, string[]>> = {
  claude: { "flat hooks file": [".claude/settings.json"], "flat MCP file": [".mcp.json"] },
  cursor: { "flat hooks file": [".cursor/hooks.json"], "flat MCP file": [".cursor/mcp.json"] },
  copilot: { "flat MCP file": [".vscode/mcp.json"] },
  opencode: { "flat config artifact": [".opencode/hooks/opencode-events.js", "opencode.json"] },
  kilo: { "flat config artifact": [".kilo/kilo.jsonc"] },
  codex: {
    "flat hooks file": [".codex/hooks.json"],
    "flat config artifact": [".codex/config.toml"],
  },
  antigravity: { "flat hooks file": [".agents/hooks.json"] },
  kiro: {
    "flat hooks file": [".kiro/hooks/aidd.json"],
    "flat MCP file": [".kiro/settings/mcp.json"],
  },
  kimi: { "flat MCP file": [".kimi-code/mcp.json"] },
};

/** Every file a build of this cell writes through a fold, by fold. */
export function foldFilesOf(
  { target, mode, contract }: BuildCell,
  plugins: readonly string[]
): Record<string, string[]> {
  if (mode === "flat") return FLAT_FOLDS[target] ?? {};
  const { manifestFileRelative } = contract;
  return {
    ...(manifestFileRelative
      ? { "plugin manifest": plugins.map((name) => `plugins/${name}/${manifestFileRelative}`) }
      : {}),
    "marketplace catalog": [CATALOG[target]],
  };
}
