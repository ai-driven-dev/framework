export interface PluginPresence {
  readonly hasAgents: boolean;
  /** Agent markdown files relative to the plugin's `agents/` dir (e.g. "planner.md"), sorted. */
  readonly agentsList: readonly string[];
  readonly skillsList: readonly string[];
  readonly hasHooksJson: boolean;
  /** The matcher groups `hooks.json` declares, by event, for a tool whose manifest carries them inline. */
  readonly hooks: Readonly<Record<string, unknown>>;
  readonly hasMcpJson: boolean;
  /** The servers `.mcp.json` declares, by name, for a tool whose manifest carries them inline. */
  readonly mcpServers: Readonly<Record<string, unknown>>;
}
