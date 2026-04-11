export interface McpExclusion {
  readonly configPath: string;
  readonly entryKey: string;
}

export function mcpExclusionEquals(a: McpExclusion, b: McpExclusion): boolean {
  return a.configPath === b.configPath && a.entryKey === b.entryKey;
}
