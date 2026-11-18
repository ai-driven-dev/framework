import { TOOL } from "../../../shared/testing/registered-tools.js";

/** Probes written out by hand, in the order the reader is to try them: it takes the first that
 * resolves, so the order below is the one every test using them states. A bare root manifest
 * comes after the nested ones. */
export const MANIFEST_PROBES = [
  { format: TOOL.claude, relativePath: ".claude-plugin/plugin.json" },
  { format: TOOL.cursor, relativePath: ".cursor-plugin/plugin.json" },
  { format: TOOL.codex, relativePath: ".codex-plugin/plugin.json" },
  { format: TOOL.copilot, relativePath: ".github/plugin/plugin.json" },
  { format: TOOL.copilot, relativePath: "plugin.json" },
] as const;
