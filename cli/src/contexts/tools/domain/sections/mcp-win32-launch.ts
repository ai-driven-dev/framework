interface McpServerWin32 {
  command?: string;
  args?: string[];
  [key: string]: unknown;
}

/** The executable a Windows launch runs in place of the one the config names. */
const WIN32_EXECUTABLES: ReadonlyMap<string, string> = new Map([
  ["uvx", "uvx.exe"],
  ["uv", "uv.exe"],
]);

function launchOnWin32(server: McpServerWin32): void {
  if (server.command === "npx") {
    server.args = ["/c", "npx", ...(server.args ?? [])];
    server.command = "cmd";
    return;
  }
  const executable =
    server.command === undefined ? undefined : WIN32_EXECUTABLES.get(server.command);
  if (executable !== undefined) server.command = executable;
}

/** The MCP config with each server's launch rewritten to run on Windows. */
export function transformMcpForWin32(content: string): string {
  const config = JSON.parse(content);
  if (!config.mcpServers) return JSON.stringify(config, null, 2);
  for (const server of Object.values<McpServerWin32>(config.mcpServers)) launchOnWin32(server);
  return JSON.stringify(config, null, 2);
}
