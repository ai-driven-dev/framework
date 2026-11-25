/** Copilot reads `servers` where the framework config writes `mcpServers`. */
export function serversKeyed(content: string): string {
  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== "object" || parsed === null) return content;
  if (!("mcpServers" in parsed) || "servers" in parsed) return content;
  const { mcpServers, ...rest } = parsed;
  return JSON.stringify({ ...rest, servers: mcpServers }, null, 2);
}
