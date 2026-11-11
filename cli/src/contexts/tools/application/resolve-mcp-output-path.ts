import { join } from "node:path";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { McpCapability } from "../domain/capabilities/mcp-capability.js";

/** The project-relative file a tool's MCP config goes in: the first tier of candidates with a file
 * already on disk (reusing user-owned configuration), the capability's fallback when none exists.
 * Two files in the answering tier raise the capability's own conflict. */
export async function resolveMcpOutputPath(
  fs: FileReader,
  mcp: McpCapability,
  projectRoot: string
): Promise<string> {
  const candidates = mcp.outputPathCandidates();
  if (candidates === null) return mcp.outputPath();
  for (const tier of candidates.tiers) {
    const present: string[] = [];
    for (const candidate of tier) {
      if (await fs.fileExists(join(projectRoot, candidate))) present.push(candidate);
    }
    if (present.length > 1) candidates.conflict();
    if (present.length === 1) return present[0] as string;
  }
  return candidates.fallback;
}
