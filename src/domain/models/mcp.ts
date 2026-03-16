interface McpServer {
  command?: string;
  args?: string[];
  [key: string]: unknown;
}

interface McpConfig {
  mcpServers?: Record<string, McpServer>;
  [key: string]: unknown;
}

export function transformFor(platform: string): ((content: string) => string) | undefined {
  return platform === "win32" ? transformMcpForWin32 : undefined;
}

function transformMcpForWin32(content: string): string {
  const config = JSON.parse(content) as McpConfig;

  if (!config.mcpServers) return JSON.stringify(config, null, 2);

  for (const server of Object.values(config.mcpServers)) {
    if (server.command === "npx") {
      server.args = ["/c", "npx", ...(server.args ?? [])];
      server.command = "cmd";
    } else if (server.command === "uvx") {
      server.command = "uvx.exe";
    } else if (server.command === "uv") {
      server.command = "uv.exe";
    }
  }

  return JSON.stringify(config, null, 2);
}
