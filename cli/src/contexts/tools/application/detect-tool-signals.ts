import { join } from "node:path";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { ToolConfig } from "../domain/registry.js";

/** The files of a tool's own signal directory the framework put there: markdown files whose
 * frontmatter names a framework command. Empty when the tool declares no signal directory. */
export async function detectToolSignals(
  fs: FileReader,
  config: ToolConfig,
  projectRoot: string
): Promise<string[]> {
  if (!config.signalDir) return [];
  const dir = join(projectRoot, config.signalDir);
  if (!(await fs.fileExists(dir))) return [];
  const files = await fs.listDirectory(dir);
  const matches: string[] = [];
  for (const filePath of files) {
    if (!filePath.endsWith(".md")) continue;
    const content = await fs.readFile(join(dir, filePath));
    if (/^name:\s*['"]?aidd[_:]/m.test(content)) matches.push(join(config.signalDir, filePath));
  }
  return matches;
}
