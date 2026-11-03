import { dirname, join, posix } from "node:path";
import { InstallationFile } from "../../../../kernel/file.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import { machineFilesOf } from "../../../tools/domain/registry.js";
import type { PluginDistribution } from "../../../translate/domain/plugin-distribution.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import { isStrictlyWithinUserScope } from "../../domain/plugins/user-scope-containment.js";

/**
 * A plugin's machine-scope files, read from the tool's built tree and keyed by their path under
 * the tool's user configuration directory. Empty for a tool that copies none.
 */
export async function readMachinePluginFiles(
  fs: FileReader,
  hasher: Hasher,
  builtDir: string,
  toolId: AiToolId,
  dist: PluginDistribution
): Promise<InstallationFile[]> {
  const machine = machineFilesOf(toolId);
  if (machine === null) return [];
  const plugin = {
    name: dist.manifest.name,
    agents: new Set(dist.components.agents.map((file) => posix.basename(file.relativePath, ".md"))),
  };
  const files: InstallationFile[] = [];
  for (const abs of await fs.listFilesRecursive(builtDir)) {
    const builtPath = posix.normalize(
      abs
        .slice(builtDir.length + 1)
        .split("\\")
        .join("/")
    );
    const relativePath = machine.map(builtPath, plugin);
    if (relativePath === null) continue;
    const content = await fs.readFile(abs);
    files.push(new InstallationFile({ relativePath, content, hash: hasher.hash(content) }));
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Refuses a machine-scope write before any byte lands: every path must stay a normalized relative
 * path, its nearest existing parent must resolve strictly inside the tool's user directory, and a
 * file already there that this plugin does not own is never overwritten unless it already holds
 * the same bytes. Creates the user directory itself when the host has not yet.
 */
export async function assertMachineFilesWritable(
  fs: FileReader & FileWriter,
  toolId: AiToolId,
  plugin: Pick<InstalledPlugin, "name" | "files"> | undefined,
  pluginName: string,
  files: readonly InstallationFile[],
  homedir: string
): Promise<string> {
  const machine = machineFilesOf(toolId);
  if (machine === null) throw new Error(`${toolId}: no machine-scope directory is declared.`);
  const boundary = machine.dir(homedir);
  await fs.createDirectory(boundary);
  const resolvedBoundary = await fs.realpath(boundary);
  for (const file of files) {
    const rel = file.relativePath;
    if (posix.isAbsolute(rel) || rel.includes("\\") || posix.normalize(rel) !== rel) {
      throw new Error(`${toolId}: '${pluginName}' path '${rel}' escapes ${boundary}.`);
    }
    let parent = dirname(join(boundary, rel));
    while (parent !== boundary) {
      const resolved = await tryRealpath(fs, parent);
      if (resolved !== null) {
        if (!isStrictlyWithinUserScope(resolved, resolvedBoundary)) {
          throw new Error(`${toolId}: '${pluginName}' parent '${parent}' escapes ${boundary}.`);
        }
        break;
      }
      parent = dirname(parent);
    }
    if (plugin?.files.has(rel) === true) continue;
    const target = join(boundary, rel);
    if (!(await fs.fileExists(target))) continue;
    if ((await fs.readFileHash(target)).value === file.hash.value) continue;
    throw new Error(
      `${toolId}: '${target}' already exists and was not installed by aidd; move or delete it, then rerun.`
    );
  }
  return boundary;
}

async function tryRealpath(fs: FileReader, path: string): Promise<string | null> {
  try {
    return await fs.realpath(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
