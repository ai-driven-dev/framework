import { join, resolve } from "node:path";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../kernel/ports/file-writer.js";
import type { AiToolId } from "../../../kernel/tool.js";
import { hasRules } from "../../tools/domain/contracts.js";
import { getToolConfig, isAiTool } from "../../tools/domain/registry.js";
import { assertProjectPathWithinRoot } from "./ownership/project-path-boundary.js";

interface PublishRulesOptions {
  toolId: AiToolId;
  projectRoot: string;
  /** Prospective project-relative rule writes or removals. Validated before any write. */
  changes?: ReadonlyMap<string, string | null>;
}

export class PublishRulesUseCase {
  constructor(private readonly fs: FileReader & FileWriter) {}

  async execute(options: PublishRulesOptions): Promise<void> {
    const tool = getToolConfig(options.toolId);
    if (!isAiTool(tool) || !hasRules(tool) || !tool.capabilities.rules.params.publication) {
      throw new Error(`Tool '${options.toolId}' has no active rule publication contract.`);
    }
    const apply = await prepareRulePublication(this.fs, options);
    for (const [path, content] of options.changes ?? []) {
      if (content === null) await this.fs.deleteFile(join(options.projectRoot, path));
      else await this.fs.writeFile(join(options.projectRoot, path), content);
    }
    await apply();
  }
}

export async function prepareRuleFiles(
  fs: FileReader & FileWriter,
  toolId: AiToolId,
  projectRoot: string,
  files: Iterable<readonly [string, string | null]>
): Promise<() => Promise<void>> {
  const tool = getToolConfig(toolId);
  if (!isAiTool(tool) || !hasRules(tool) || !tool.capabilities.rules.params.publication)
    return async () => {};
  const location = tool.capabilities.rules.installedLocation();
  const changes = new Map(
    [...files].filter(
      ([path]) =>
        location && path.startsWith(location.directory) && path.endsWith(location.extension)
    )
  );
  return prepareRulePublication(fs, { toolId, projectRoot, changes });
}

/** Lifecycle callers preflight prospective rules before mutating any project file. */
export async function prepareRulePublication(
  fs: FileReader & FileWriter,
  options: PublishRulesOptions
): Promise<() => Promise<void>> {
  const tool = getToolConfig(options.toolId);
  if (!isAiTool(tool) || !hasRules(tool) || !tool.capabilities.rules.params.publication) {
    if (options.changes?.size)
      throw new Error(`Tool '${options.toolId}' has no active rule publication contract.`);
    return async () => {};
  }
  const { target, render } = tool.capabilities.rules.params.publication;
  const location = tool.capabilities.rules.installedLocation();
  if (!location) throw new Error(`Tool '${options.toolId}' has no editable rule location.`);
  const sources = new Map<string, string>();
  const root = resolve(options.projectRoot);
  const targetPath = join(root, target);
  await assertProjectPathWithinRoot(fs, root, targetPath);
  const existing = (await fs.fileExists(targetPath)) ? await fs.readFile(targetPath) : "";
  // Inspect ownership first, even when a source is subsequently removed.
  render(existing, []);
  const directory = join(root, location.directory);
  await assertProjectPathWithinRoot(fs, root, directory);
  for (const path of (await fs.fileExists(directory)) ? await fs.listDirectory(directory) : []) {
    if (!path.endsWith(location.extension)) continue;
    const key = `${location.directory}${path}`;
    assertSourcePath(key, location.directory, location.extension);
    await assertProjectPathWithinRoot(fs, root, join(root, key));
    sources.set(key, await fs.readFile(join(root, key)));
  }
  for (const [path, content] of options.changes ?? []) {
    assertSourcePath(path, location.directory, location.extension);
    await assertProjectPathWithinRoot(fs, root, join(root, path));
    if (content === null) sources.delete(path);
    else sources.set(path, content);
  }
  const updated = render(
    existing,
    [...sources].map(([path, content]) => ({ path, content }))
  );
  return async () => {
    if (updated === existing) return;
    if (updated === "") await fs.deleteFile(targetPath);
    else await fs.writeFile(targetPath, updated);
  };
}

function assertSourcePath(path: string, directory: string, extension: string): void {
  if (
    !path.startsWith(directory) ||
    !path.endsWith(extension) ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    /[\\\r\n\0]/.test(path)
  ) {
    throw new Error(`Unsafe rule source path '${path}'; use a Markdown path under ${directory}.`);
  }
}
