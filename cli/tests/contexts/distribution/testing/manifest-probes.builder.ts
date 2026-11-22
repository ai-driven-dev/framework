import type { NamedTools } from "../../../shared/testing/named-tools.builder.js";

/** Probes written out by hand, in the order the reader is to try them: it takes the first that
 * resolves, so the order below is the one every test using them states. A bare root manifest
 * comes after the nested ones. */
export function manifestProbes(tool: NamedTools<"claude" | "cursor" | "codex" | "copilot">) {
  return [
    { format: tool.claude, relativePath: ".claude-plugin/plugin.json" },
    { format: tool.cursor, relativePath: ".cursor-plugin/plugin.json" },
    { format: tool.codex, relativePath: ".codex-plugin/plugin.json" },
    { format: tool.copilot, relativePath: ".github/plugin/plugin.json" },
    { format: tool.copilot, relativePath: "plugin.json" },
  ] as const;
}
