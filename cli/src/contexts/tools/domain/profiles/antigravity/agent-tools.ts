/** agy 1.5.9's own Claude subagent conversion. An unknown name may hang an agy subagent. */
const ALL_AGY_TOOLS = [
  "read_file",
  "edit_file",
  "write_file",
  "run_command",
  "manage_task",
  "search_web",
] as const;

const AGY_TOOLS_BY_CLAUDE_TOOL = new Map<string, readonly string[]>([
  ["Read", ["read_file"]],
  ["Glob", ["read_file"]],
  ["Grep", ["read_file"]],
  ["Edit", ["edit_file"]],
  ["MultiEdit", ["edit_file"]],
  ["Write", ["write_file"]],
  ["Bash", ["run_command", "manage_task"]],
  ["WebSearch", ["search_web"]],
  ["WebFetch", ["search_web"]],
]);

/** No declared list means every tool: agy gives an agent without `tools` a read-only set. A grant with no agy equivalent is dropped, never widened. */
export function antigravityAgentTools(declared: readonly string[] | null): string[] {
  if (declared === null) return [...ALL_AGY_TOOLS];
  const granted = new Set(declared.flatMap((tool) => AGY_TOOLS_BY_CLAUDE_TOOL.get(tool) ?? []));
  return ALL_AGY_TOOLS.filter((tool) => granted.has(tool));
}
